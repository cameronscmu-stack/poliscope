# Navigation & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent sticky top nav with search, a filter bar with chamber/party/state/grade filters, and client-side filtering to replace the rudimentary Home page masthead.

**Architecture:** A `FilterContext` lifts all filter state (chamber, party, state, grade, search query) to app level so `TopNav` and `FilterBar` can share it without prop drilling. `App.jsx` wraps the router in `FilterProvider` and renders `TopNav` above `<Routes>`. `Home.jsx` reads filters from context and applies them in-memory to the already-fetched members array before passing to `ChamberGrid`. `ChamberGrid`, `SeatDot`, and `PlayerPage` are untouched.

**Tech Stack:** React 19, React Router v7, Vitest + @testing-library/react, CSS custom properties (no new libraries)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `client/src/context/FilterContext.jsx` | Context + FilterProvider + useFilter hook |
| Create | `client/src/context/FilterContext.test.jsx` | Context unit tests |
| Create | `client/src/components/TopNav/TopNav.jsx` | Sticky nav: wordmark, search, nav links, back button |
| Create | `client/src/components/TopNav/TopNav.test.jsx` | TopNav unit tests |
| Create | `client/src/components/FilterBar/FilterBar.jsx` | Chamber toggle, party chips, state/grade selects |
| Create | `client/src/components/FilterBar/FilterBar.test.jsx` | FilterBar unit tests |
| Modify | `client/src/App.jsx` | Wrap in FilterProvider, render TopNav above Routes |
| Modify | `client/src/pages/Home.jsx` | Remove masthead + toggle, read context, apply filters |
| Modify | `client/src/pages/Rep.jsx` | Remove inline back button (TopNav owns it now) |

---

### Task 1: FilterContext

**Files:**
- Create: `client/src/context/FilterContext.jsx`
- Create: `client/src/context/FilterContext.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// client/src/context/FilterContext.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterProvider, useFilter } from './FilterContext';

function TestConsumer() {
  const { chamber, setChamber, party, setParty, stateFilter, setStateFilter,
          gradeFilter, setGradeFilter, searchQuery, setSearchQuery } = useFilter();
  return (
    <div>
      <span data-testid="chamber">{chamber}</span>
      <span data-testid="party">{party}</span>
      <span data-testid="state">{stateFilter}</span>
      <span data-testid="grade">{gradeFilter}</span>
      <span data-testid="search">{searchQuery}</span>
      <button onClick={() => setChamber('house')}>set house</button>
      <button onClick={() => setParty('R')}>set R</button>
      <button onClick={() => setStateFilter('CA')}>set CA</button>
      <button onClick={() => setGradeFilter('A')}>set A</button>
      <button onClick={() => setSearchQuery('pelosi')}>set search</button>
    </div>
  );
}

describe('FilterContext', () => {
  it('provides default values', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    expect(screen.getByTestId('chamber').textContent).toBe('senate');
    expect(screen.getByTestId('party').textContent).toBe('all');
    expect(screen.getByTestId('state').textContent).toBe('all');
    expect(screen.getByTestId('grade').textContent).toBe('all');
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('setChamber updates chamber', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set house'));
    expect(screen.getByTestId('chamber').textContent).toBe('house');
  });

  it('setParty updates party', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set R'));
    expect(screen.getByTestId('party').textContent).toBe('R');
  });

  it('setStateFilter updates stateFilter', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set CA'));
    expect(screen.getByTestId('state').textContent).toBe('CA');
  });

  it('setGradeFilter updates gradeFilter', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set A'));
    expect(screen.getByTestId('grade').textContent).toBe('A');
  });

  it('setSearchQuery updates searchQuery', () => {
    render(<FilterProvider><TestConsumer /></FilterProvider>);
    fireEvent.click(screen.getByText('set search'));
    expect(screen.getByTestId('search').textContent).toBe('pelosi');
  });

  it('throws when used outside FilterProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useFilter must be used within FilterProvider');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx vitest run src/context/FilterContext.test.jsx
```
Expected: FAIL — `Cannot find module './FilterContext'`

- [ ] **Step 3: Create FilterContext**

```jsx
// client/src/context/FilterContext.jsx
import { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [chamber, setChamber] = useState('senate');
  const [party, setParty] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <FilterContext.Provider value={{
      chamber, setChamber,
      party, setParty,
      stateFilter, setStateFilter,
      gradeFilter, setGradeFilter,
      searchQuery, setSearchQuery,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter must be used within FilterProvider');
  return ctx;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd client && npx vitest run src/context/FilterContext.test.jsx
```
Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add client/src/context/FilterContext.jsx client/src/context/FilterContext.test.jsx
git commit -m "Add FilterContext with chamber, party, state, grade, search state"
```

---

### Task 2: TopNav component

**Files:**
- Create: `client/src/components/TopNav/TopNav.jsx`
- Create: `client/src/components/TopNav/TopNav.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// client/src/components/TopNav/TopNav.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FilterProvider } from '../../context/FilterContext';
import { TopNav } from './TopNav';

function renderTopNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FilterProvider>
        <TopNav />
      </FilterProvider>
    </MemoryRouter>
  );
}

describe('TopNav', () => {
  it('renders POLISCOPE wordmark', () => {
    renderTopNav();
    expect(screen.getByText('POLISCOPE')).toBeInTheDocument();
  });

  it('renders search input on home route', () => {
    renderTopNav('/');
    expect(screen.getByPlaceholderText('Search members…')).toBeInTheDocument();
  });

  it('does not render search input on rep route', () => {
    renderTopNav('/rep/A000001');
    expect(screen.queryByPlaceholderText('Search members…')).not.toBeInTheDocument();
  });

  it('renders back button on rep route', () => {
    renderTopNav('/rep/A000001');
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('renders Congress nav link', () => {
    renderTopNav();
    expect(screen.getByRole('link', { name: 'Congress' })).toBeInTheDocument();
  });

  it('typing in search updates context searchQuery', () => {
    renderTopNav('/');
    const input = screen.getByPlaceholderText('Search members…');
    fireEvent.change(input, { target: { value: 'warren' } });
    expect(input.value).toBe('warren');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx vitest run src/components/TopNav/TopNav.test.jsx
```
Expected: FAIL — `Cannot find module './TopNav'`

- [ ] **Step 3: Create TopNav**

```jsx
// client/src/components/TopNav/TopNav.jsx
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useFilter } from '../../context/FilterContext';

export function TopNav() {
  const { searchQuery, setSearchQuery } = useFilter();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 12px var(--shadow)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 16px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '2px',
            color: 'var(--navy)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          POLISCOPE
        </Link>

        <div style={{ flex: 1 }}>
          {isHome ? (
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search members…"
              aria-label="Search members"
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.6)',
                color: 'var(--navy)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          ) : (
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--sky-accent)',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: 0,
              }}
            >
              ← Back
            </button>
          )}
        </div>

        <nav style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
          <NavLink to="/" label="Congress" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, label }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      style={{
        fontSize: '0.875rem',
        fontWeight: 600,
        color: active ? 'var(--sky-accent)' : 'var(--navy)',
        textDecoration: 'none',
        borderBottom: active ? '2px solid var(--sky-accent)' : '2px solid transparent',
        paddingBottom: '2px',
        opacity: active ? 1 : 0.7,
      }}
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd client && npx vitest run src/components/TopNav/TopNav.test.jsx
```
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TopNav/TopNav.jsx client/src/components/TopNav/TopNav.test.jsx
git commit -m "Add TopNav component with search input and back button"
```

---

### Task 3: FilterBar component

**Files:**
- Create: `client/src/components/FilterBar/FilterBar.jsx`
- Create: `client/src/components/FilterBar/FilterBar.test.jsx`

- [ ] **Step 1: Write the failing tests**

```jsx
// client/src/components/FilterBar/FilterBar.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FilterProvider } from '../../context/FilterContext';
import { FilterBar } from './FilterBar';

function renderFilterBar() {
  return render(
    <FilterProvider>
      <FilterBar />
    </FilterProvider>
  );
}

describe('FilterBar', () => {
  it('renders Senate and House buttons', () => {
    renderFilterBar();
    expect(screen.getByRole('button', { name: 'Senate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'House' })).toBeInTheDocument();
  });

  it('Senate button is active by default', () => {
    renderFilterBar();
    const senate = screen.getByRole('button', { name: 'Senate' });
    expect(senate.style.backgroundColor).toBe('var(--navy)');
  });

  it('clicking House switches chamber', () => {
    renderFilterBar();
    fireEvent.click(screen.getByRole('button', { name: 'House' }));
    const house = screen.getByRole('button', { name: 'House' });
    expect(house.style.backgroundColor).toBe('var(--navy)');
  });

  it('renders party filter buttons', () => {
    renderFilterBar();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Republican' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Democrat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Independent' })).toBeInTheDocument();
  });

  it('clicking Republican sets party filter', () => {
    renderFilterBar();
    fireEvent.click(screen.getByRole('button', { name: 'Republican' }));
    const btn = screen.getByRole('button', { name: 'Republican' });
    expect(btn.style.color).toBe('white');
  });

  it('renders state select with All states option', () => {
    renderFilterBar();
    expect(screen.getByRole('combobox', { name: 'Filter by state' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All states' })).toBeInTheDocument();
  });

  it('renders grade select with All grades option', () => {
    renderFilterBar();
    expect(screen.getByRole('combobox', { name: 'Filter by grade' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All grades' })).toBeInTheDocument();
  });

  it('changing state select updates stateFilter', () => {
    renderFilterBar();
    const select = screen.getByRole('combobox', { name: 'Filter by state' });
    fireEvent.change(select, { target: { value: 'CA' } });
    expect(select.value).toBe('CA');
  });

  it('changing grade select updates gradeFilter', () => {
    renderFilterBar();
    const select = screen.getByRole('combobox', { name: 'Filter by grade' });
    fireEvent.change(select, { target: { value: 'A' } });
    expect(select.value).toBe('A');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd client && npx vitest run src/components/FilterBar/FilterBar.test.jsx
```
Expected: FAIL — `Cannot find module './FilterBar'`

- [ ] **Step 3: Create FilterBar**

```jsx
// client/src/components/FilterBar/FilterBar.jsx
import { useFilter } from '../../context/FilterContext';

const STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'AS', name: 'American Samoa' }, { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'VI', name: 'Virgin Islands' },
];

const PARTY_OPTIONS = [
  { value: 'all', label: 'All', color: null },
  { value: 'R', label: 'Republican', color: '#cc0000' },
  { value: 'D', label: 'Democrat', color: '#1a4aaa' },
  { value: 'I', label: 'Independent', color: '#555555' },
];

const pillBase = {
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  border: '1px solid var(--border)',
};

const selectStyle = {
  padding: '4px 8px',
  borderRadius: '20px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--navy)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  outline: 'none',
};

export function FilterBar() {
  const {
    chamber, setChamber,
    party, setParty,
    stateFilter, setStateFilter,
    gradeFilter, setGradeFilter,
  } = useFilter();

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 16px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Chamber toggle */}
        {['senate', 'house'].map(c => (
          <button
            key={c}
            onClick={() => setChamber(c)}
            style={{
              ...pillBase,
              fontWeight: 700,
              background: chamber === c ? 'var(--navy)' : 'var(--surface)',
              color: chamber === c ? 'white' : 'var(--navy)',
            }}
          >
            {c === 'senate' ? 'Senate' : 'House'}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} aria-hidden="true" />

        {/* Party filter */}
        {PARTY_OPTIONS.map(opt => {
          const active = party === opt.value;
          const activeColor = opt.color ?? 'var(--navy)';
          return (
            <button
              key={opt.value}
              onClick={() => setParty(opt.value)}
              style={{
                ...pillBase,
                background: active ? activeColor : 'var(--surface)',
                color: active ? 'white' : 'var(--navy)',
                border: active && opt.color ? `1px solid ${opt.color}` : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          );
        })}

        {/* State + Grade dropdowns */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            aria-label="Filter by state"
            style={selectStyle}
          >
            <option value="all">All states</option>
            {STATES.map(s => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>

          <select
            value={gradeFilter}
            onChange={e => setGradeFilter(e.target.value)}
            aria-label="Filter by grade"
            style={selectStyle}
          >
            <option value="all">All grades</option>
            {['A', 'B', 'C', 'D', 'F'].map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd client && npx vitest run src/components/FilterBar/FilterBar.test.jsx
```
Expected: 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add client/src/components/FilterBar/FilterBar.jsx client/src/components/FilterBar/FilterBar.test.jsx
git commit -m "Add FilterBar with chamber, party, state, and grade filters"
```

---

### Task 4: Wire App.jsx

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace App.jsx**

```jsx
// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FilterProvider } from './context/FilterContext';
import { TopNav } from './components/TopNav/TopNav';
import Home from './pages/Home';
import Rep from './pages/Rep';

export default function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <TopNav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rep/:id" element={<Rep />} />
        </Routes>
      </FilterProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Run all client tests to confirm nothing is broken**

```bash
cd client && npx vitest run
```
Expected: all existing tests + new tests pass

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "Wire FilterProvider and TopNav into App shell"
```

---

### Task 5: Update Home.jsx

**Files:**
- Modify: `client/src/pages/Home.jsx`

- [ ] **Step 1: Replace Home.jsx**

Remove the masthead header and chamber toggle. Read all filters from `useFilter()`. Apply client-side filtering before passing to `ChamberGrid`. Render `FilterBar` at the top of the page.

```jsx
// client/src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import { ChamberGrid } from '../components/ChamberGrid/ChamberGrid';
import { FilterBar } from '../components/FilterBar/FilterBar';
import { useFilter } from '../context/FilterContext';
import { useMembers } from '../hooks/useMembers';

const PARTY_DISPLAY = { R: 'republican', D: 'democrat', I: 'independent' };

function filterMembers(members, { party, stateFilter, gradeFilter, searchQuery }) {
  return members.filter(m => {
    if (party !== 'all' && m.party !== party) return false;
    if (stateFilter !== 'all' && m.state !== stateFilter) return false;
    if (gradeFilter !== 'all' && m.letter_grade !== gradeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      const partyName = PARTY_DISPLAY[m.party] ?? '';
      if (
        !fullName.includes(q) &&
        !m.state.toLowerCase().includes(q) &&
        !partyName.includes(q)
      ) return false;
    }
    return true;
  });
}

export default function Home() {
  const navigate = useNavigate();
  const { chamber, party, stateFilter, gradeFilter, searchQuery } = useFilter();
  const { members, loading, error } = useMembers(chamber);

  const visible = filterMembers(members, { party, stateFilter, gradeFilter, searchQuery });

  return (
    <div className="min-h-screen">
      <FilterBar />
      {error && (
        <p className="text-sm px-4 py-2" style={{ color: 'var(--alert)' }}>
          Could not load members: {error}
        </p>
      )}
      <div className="px-4 py-6">
        <ChamberGrid
          members={visible}
          loading={loading}
          onSelectMember={id => navigate(`/rep/${id}`)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all client tests**

```bash
cd client && npx vitest run
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "Update Home to use FilterContext and apply client-side filtering"
```

---

### Task 6: Update Rep.jsx

**Files:**
- Modify: `client/src/pages/Rep.jsx`

- [ ] **Step 1: Remove the inline back button from Rep.jsx**

The back button now lives in `TopNav` (it renders `← Back` on non-home routes). Remove the `useNavigate` import and back button markup.

```jsx
// client/src/pages/Rep.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerPage } from '../components/PlayerPage/PlayerPage';

export default function Rep() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(setMember)
      .catch(err => setError(err.message));
  }, [id]);

  return (
    <div className="min-h-screen">
      {error ? (
        <div className="px-4 pt-4">
          <p style={{ color: 'var(--alert)' }}>Member not found.</p>
        </div>
      ) : (
        <PlayerPage member={member} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run all client tests**

```bash
cd client && npx vitest run
```
Expected: all tests pass

- [ ] **Step 3: Push to GitHub — triggers Vercel auto-deploy**

```bash
git add client/src/pages/Rep.jsx
git commit -m "Remove inline back button from Rep (TopNav owns it)"
git push origin main
```

Expected: Vercel build triggers automatically. Check https://vercel.com/cameronscmu-stacks-projects/poliscope for deployment status.

---

## Final verification

After all tasks complete, run the full test suite:

```bash
cd client && npx vitest run
```

Expected output: all tests pass (existing 13 + new 22 = 35 tests)

Then open the Vercel URL and verify:
1. POLISCOPE wordmark appears in sticky header
2. Search bar filters the member grid as you type
3. Senate/House toggle switches the chamber
4. Republican/Democrat chips filter by party
5. State dropdown filters to that state's members
6. On a rep page, `← Back` appears instead of the search bar
