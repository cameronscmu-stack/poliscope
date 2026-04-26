# Poliscope — Product Design Spec
**Date:** 2026-04-25  
**Status:** Approved  
**Author:** Cam Margeson

---

## Vision

Poliscope is a mobile-first web app that brings radical transparency to American democracy. It presents publicly available data on every U.S. Senator and Representative in a unified, sports-broadcast-style interface — giving everyday Americans the same access to information that lobbyists and political insiders have always had.

**Core principle:** Every piece of information is objective, auditable, and cited. The algorithm scores. The AI narrates. The user decides.

**Product character:** A reference and lookup tool — beautifully designed, always current (updated to the minute via scheduled data ingestion), but not a live broadcast. Think ESPN stats page, not ESPN live game coverage.

**Mission:** Civic good first. Revenue is a means to fund more projects like this — never the end goal. The app will never accept political advertising or PAC funding.

---

## Target Users

- **Everyday voters** — want a simple, digestible answer to "is my rep actually working for me?"
- **Politically engaged citizens** — want raw data, deep dives, and the ability to fact-check everything

Both users are served by the same interface. The player card serves the casual user. The halftime screen serves the power user.

---

## Platform

**Mobile-first web app** — React + Vite + Tailwind CSS, responsive design optimized for phone screens. No app store required. Shareable URLs for every politician, every bill, every event. Viral sharing is a growth mechanism.

---

## The Four Screens

### 1. Chamber View (Home)

The default view. An interactive 3D rendering of the U.S. Senate or House chamber, built with React Three Fiber. Each seat represents a sitting member. Toggle between Senate (100 seats) and House (435 seats) with an animated camera sweep between chambers.

**Seat visual encoding:**
- Color = party (blue / red / independent)
- Glow intensity = Constituent Grade (bright green = A, dim red = F)
- Activity indicator = pulse animation on seats with activity in the last 24 hours
- Empty seats = visually distinct (vacancy, not yet sworn in)

**Interaction:**
- Tap any seat → Politician Player Card rises from the bottom as a Motion spring sheet
- Filter overlay: grade range, state, party, committee membership
- Search bar to jump directly to a member by name or state
- Data refreshes on page load and every 60 seconds via polling — no WebSocket complexity

**Toggle bar:** Senate | House — persistent at the top of the screen

---

### 2. Politician Player Card

A compact, at-a-glance stat block. The quick view. Appears as a bottom sheet when tapping from the chamber, or as a standalone page via direct URL.

**Contents:**
- Official photo, full name, party, state, chamber, current term
- **Constituent Grade: A–F (0–100)** — letter grade headline (large), number underneath (small)
- Four quick stats:
  - Attendance % (current session)
  - Stock trades filed (YTD count + total $)
  - Net worth change since taking office
  - Top donor category (e.g., "Finance & Banking")
- Activity badge if voted in last 24 hours
- "Full breakdown →" button → opens Politician Halftime screen

---

### 3. Politician Halftime Screen

The full season breakdown. Everything on one scrollable page.

**Sections:**
1. **Constituent Grade breakdown** — letter + number, with sub-scores for each of the five dimensions
2. **Voting record** — searchable, filterable by issue category (healthcare, defense, environment, economy, etc.). Shows vote, bill name, plain-English summary, and date
3. **Attendance record** — session-by-session, missed votes flagged
4. **Financial disclosures**
   - Stock trades timeline (amount, company, buy/sell, days before/after related vote)
   - Net worth: entering office vs. current vs. national median for comparison
   - Real estate holdings
5. **Campaign finance**
   - Total raised, breakdown by donor category (individual, PAC, corporate)
   - Top 10 donors listed
   - PAC money accepted: yes/no, total amount, PAC names
6. **Conflict of interest flags** — auto-generated: stock trades within 30 days of a vote on related legislation, highlighted in red with explanation
7. **Bills sponsored / co-sponsored** — with status and outcome

---

### 4. Bill Halftime Screen

Plain-English breakdown of any bill on the floor or in committee.

**Sections:**
1. **What is this bill?** — 3-sentence plain English summary (AI-narrated from structured data)
2. **Who does it help?** — scored, with specific demographic/industry groups named and cited
3. **Who does it hurt?** — same treatment, same rigor
4. **What does it cost?** — CBO estimate, displayed simply ("$240B over 10 years")
5. **Who lobbied for it?** — top lobbying organizations and their industries
6. **The vote** — how every member voted, with their Constituent Grade shown alongside
7. **Conflict check** — any member who voted AND holds stock in a beneficiary company, flagged automatically with details

---

## Constituent Grade — Scoring Methodology

A single A–F letter grade (backed by a 0–100 score) representing how much a politician is working for their constituents vs. themselves or their party. Fully algorithmic, methodology published publicly.

### Five Scoring Dimensions (equally weighted in v1, tunable)

| Dimension | What It Measures | Data Source |
|---|---|---|
| **Constituent Alignment** | Vote alignment with district's demographic/economic interests vs. national party line | Congress.gov votes + district census data |
| **Financial Self-Dealing** | Stock trades correlated with their own votes; net worth growth vs. national median | STOCK Act eFD disclosures |
| **Party Independence** | % of votes that break from party line | ProPublica Congress API |
| **Attendance** | % of votes attended vs. missed | Congress.gov |
| **Legislative Impact** | Bills sponsored that became law; meaningful committee participation | Congress.gov |

### Scoring Rules
- Each dimension scores 0–100
- Final score = average of five dimensions
- Letter grades: A (90–100), B (80–89), C (70–79), D (60–69), F (below 60)
- Score recalculates nightly from fresh data
- Methodology document published at `/about/methodology` — every formula, every data source, every edge case documented publicly

### AI Role (narration only)
Claude is used **exclusively** to translate scores into plain English. It receives structured data (scores, citations, raw numbers) and outputs readable sentences. It does not interpret, editorialize, or make judgments. Every AI-generated sentence cites the specific data point it describes.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | React + Vite | Fast builds, SPA routing |
| Styling | Tailwind CSS | Layout and utility layer |
| 3D Chamber | React Three Fiber (Three.js) | Interactive 3D seat visualization |
| Charts & Data Viz | Visx (Airbnb) | Animated React-native D3 charts |
| District Maps | D3.js | Geographic maps, custom layouts |
| Page Transitions | Motion (Framer Motion) | Spring physics, card reveals, staggered entrances |
| Complex Timelines | GSAP | Scroll-driven sequences, orchestrated animations |
| Icon & Badge Animation | Rive | Interactive achievement animations, grade badge reveals |
| Global State | Zustand | Gamification state, user prefs, session data |
| Backend | Node.js + Express | Thin routes, service layer |
| Database | PostgreSQL (managed) | All persistent data |
| Caching | Redis | API response caching, rate limit buffers |
| AI | Anthropic Claude | Narration only, prompt caching, streaming |
| Auth | JWT + email/social login | Built in from day one |
| Hosting | Digital Ocean App Platform | Frontend + backend |
| Data ingestion | Node-cron workers | Per-source scheduled jobs, every 1–60 min |

---

## Gamification System

Psychological engagement through learning rewards — no live-event dependency required.

**Badges (earned by using the app):**
- "Follow the Money" — reviewed 10 stock trade disclosures
- "Bill Watcher" — read 5 full bill breakdowns
- "Constituent Champion" — checked your reps 30 days in a row
- "Conflict Spotter" — opened a flagged conflict of interest
- "Both Sides Now" — read bill breakdowns for bills that passed and failed

**Streaks:**
- Daily check-in streak during active legislative sessions
- Displayed as a GitHub-style contribution graph on the user profile
- Streak pauses (not breaks) during Congressional recess — keeps it fair

**Progressive disclosure:**
- Casual users see the essentials on first visit
- Deeper data layers (historical comparisons, raw exports, custom alerts) reveal as engagement increases
- Achievements unlock these layers explicitly — learning is the gate, not a paywall

**Rive animations:**
- Grade badge animates on reveal (spins in, locks into letter)
- Achievement unlock triggers a short celebratory animation
- Streak milestone gets a special visual moment

---

## Data Sources

| Source | Data | Update Frequency |
|---|---|---|
| Congress.gov API | Votes, bills, attendance, committee activity | Every 5 minutes during session, hourly otherwise |
| FEC API | Campaign contributions, PAC money, donor data | Daily |
| Senate eFD / STOCK Act | Financial disclosures, stock trades | As filed (can lag weeks — disclosed clearly to user) |
| ProPublica Congress API | Vote scores, bill history, member profiles | Daily |
| CBO | Bill cost estimates | As published |
| Think tank balance layer | Expert consensus scoring — Brookings (center-left), Heritage (right), Cato (libertarian), Urban Institute (center-left), AEI (right). Averaged across spectrum, no single framing dominates. | Curated per major bill |

---

## Revenue Model (Flexible)

Auth and user accounts are in from day one so monetization can be layered without a rewrite.

**Potential tiers (to be decided post-launch):**
- **Free:** Full access to all public data, politician profiles, bill breakdowns, chamber view
- **Premium:** Custom alerts (stock trade filed, missed vote, new bill), data exports, historical comparisons
- **Supporter:** Voluntary donation tier for users who want to fund the mission

**Non-negotiable:** No political advertising. No PAC funding. No sponsored content.

---

## URL Structure

```
/                          → Chamber view (home)
/rep/[state]-[name]        → Politician player card
/rep/[state]-[name]/full   → Politician halftime screen
/bill/[congress]-[number]  → Bill halftime screen
/about/methodology         → Public scoring methodology
```

---

## Parking Lot (revisit post-v1)

These ideas have merit but add scope or require validation before committing:

- **Civic Score** — a grade for the user based on their own engagement and knowledge. Compelling concept but risks feeling intrusive or gamey in a way that undermines the app's serious civic tone. Revisit after seeing how users engage with the politician grades.
- **Live vote streaming** — WebSocket-driven real-time vote feed as Congress votes. High technical complexity and infrastructure cost for a reference tool. Strong feature for v2 once core product is proven.

---

## What Makes This Different

1. **The chamber as home** — you don't search a database. You walk into the room. Every seat is a person.
2. **The Constituent Grade** — a single auditable number that answers the question voters actually have.
3. **Conflict of interest auto-detection** — no one has to connect the dots manually. The system flags it.
4. **Provable objectivity** — published methodology, cited claims, algorithm-first scoring. Defensible against accusations of bias from any direction.
5. **Shareable** — every politician, every bill, every trade is a link. This is how it grows.
