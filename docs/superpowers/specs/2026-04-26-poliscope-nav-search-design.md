# Poliscope Navigation & Search — Design Spec

**Date:** 2026-04-26
**Scope:** Add persistent top nav bar, filter tab bar, and live search to replace the rudimentary Home page masthead. Designed for easy visual reskin later.

---

## Goal

Replace the current inline masthead + chamber toggle with a proper app shell: persistent top nav across all pages, a filter bar on the Congress view, and live search that filters the member grid in real time. All styling uses existing CSS custom properties (`--navy`, `--sky-accent`, `--surface`, etc.) so the visual layer can be swapped without touching component logic.

---

## Architecture

### New components

| Component | File | Responsibility |
|-----------|------|----------------|
| `TopNav` | `components/TopNav/TopNav.jsx` | Persistent header: wordmark, search input, nav links |
| `FilterBar` | `components/FilterBar/FilterBar.jsx` | Senate/House toggle + party/state/grade filter chips |

### New context

| Context | File | Provides |
|---------|------|----------|
| `FilterContext` | `context/FilterContext.jsx` | `chamber`, `party`, `stateFilter`, `gradeFilter`, `searchQuery` + setters |

### Modified files

| File | Change |
|------|--------|
| `App.jsx` | Wrap routes in `FilterProvider` + render `TopNav` above `<Routes>` |
| `pages/Home.jsx` | Remove masthead + chamber toggle; read filters from context; filter members client-side |
| `pages/Rep.jsx` | Remove inline back button (TopNav handles back navigation on non-home routes) |

---

## FilterContext

```js
// Default state
{
  chamber: 'senate',       // 'senate' | 'house'
  party: 'all',            // 'all' | 'R' | 'D' | 'I'
  stateFilter: 'all',      // 'all' | two-letter state code
  gradeFilter: 'all',      // 'all' | 'A' | 'B' | 'C' | 'D' | 'F'
  searchQuery: '',         // free text
}
```

Exposed via `useFilter()` hook. Context wraps the entire app so TopNav and FilterBar can both read/write without prop drilling.

---

## TopNav

**Layout:** full-width bar, `position: sticky; top: 0; z-index: 50`

**Left:** POLISCOPE wordmark (Bricolage Grotesque 800, `--navy`)

**Center:** search input — placeholder "Search members…", controlled by `searchQuery` in context. Updates context on every keystroke (no debounce needed at this data size). On the `/rep/:id` route, show a "← Back" button instead of the search input.

**Right:** nav links — "Congress" (routes to `/`), future slots for "About" etc. Active route link gets `--sky-accent` color + underline.

**Styling:** `background: var(--surface); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border)`. This inherits the existing glass aesthetic and is trivially reskinnable.

---

## FilterBar

Rendered only on the Home (`/`) route, beneath TopNav.

**Row 1 — Chamber toggle:**
- Two pill buttons: "Senate" / "House"
- Active pill: `background: var(--navy); color: white`
- Inactive: `background: var(--surface); color: var(--navy); border: 1px solid var(--border)`

**Row 1 continued — Party filter (same row, separated by a divider):**
- Chips: "All" · "Republican" · "Democrat" · "Independent"
- Active chip: filled with party color (`#cc0000` R, `#1a4aaa` D, `#555` I)

**Row 1 continued — State + Grade dropdowns (right-aligned):**
- `<select>` elements styled with CSS variables
- State: all 50 states + DC + territories, alphabetical
- Grade: A / B / C / D / F

On mobile (< 640px), the party chips wrap to a second row.

---

## Search & filter logic (client-side, in Home.jsx)

```
members               ← from useMembers(chamber)
  → filter by party   ← context.party
  → filter by state   ← context.stateFilter
  → filter by grade   ← context.gradeFilter
  → filter by search  ← context.searchQuery (matches first_name, last_name, state, party display name)
  → pass to ChamberGrid
```

All filtering is in-memory on the already-fetched array. No new API calls.

---

## What does NOT change

- `ChamberGrid`, `SeatDot`, `PlayerPage` — zero changes to these components
- `useMembers` hook — unchanged
- All CSS custom properties — unchanged
- `index.css` — no changes (only component-level styles added inline or via Tailwind)

---

## Design token contract

All new components use only these tokens, never hardcoded colors:

```
--navy, --sky-accent, --surface, --border, --bg-sky, --alert, --positive, --shadow
```

Party colors (`#cc0000`, `#1a4aaa`, `#555555`) are the only intentional exceptions — they are semantic data, not theme values.

When a future redesign swaps `:root` custom properties, TopNav and FilterBar update automatically. No component changes needed.

---

## Testing

- `TopNav.test.jsx`: renders wordmark; search input updates context; back button appears on non-home route; nav links render
- `FilterBar.test.jsx`: chamber toggle updates context; party chip toggles; state/grade selects update context
- `FilterContext.test.jsx` (or inline in above): useFilter returns defaults; setters update correctly

Existing tests (`ChamberGrid`, `SeatDot`, `PlayerPage`, `members route`) must continue to pass unchanged.

---

## Out of scope

- Visual redesign / color theme swap (deferred — user will bring reference examples)
- Server-side search API endpoint (client-side filter is sufficient for ~535 members)
- URL-synced filters (no query params in v1 — filters reset on navigation)
- Mobile hamburger menu (nav links are short enough to stay visible at mobile widths)
