# Poliscope — Product Design Spec
**Date:** 2026-04-25  
**Status:** Approved  
**Author:** Cam Margeson

---

## Vision

Poliscope is a mobile-first web app that brings radical transparency to American democracy. It presents publicly available data on every U.S. Senator and Representative in a unified, sports-broadcast-style interface — giving everyday Americans the same access to information that lobbyists and political insiders have always had.

**Core principle:** Every piece of information is objective, auditable, and cited. The algorithm scores. The AI narrates. The user decides.

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

### 1. Live Ticker Feed (Home)
The default view. A real-time stream of activity across all 535 members of Congress, sorted by recency.

**Feed events include:**
- Vote cast (YES/NO/Present/Absent) with bill name and plain-English summary
- Stock trade filed (STOCK Act disclosure) with amount, company, and any bill conflict flag
- Campaign contribution received (over threshold) with donor category
- Bill introduced or advanced out of committee
- Attendance miss (missed vote without announced reason)
- Net worth disclosure update

**UI behavior:**
- Infinite scroll, swipe up like a social feed
- Each event is a card with politician photo, name, event type badge, and one-line summary
- Tap any event → opens the Politician Player Card or Bill Halftime depending on type
- Filter bar: All / Votes / Trades / Money / Bills
- "My Reps" toggle — shows only the user's Senators and Representative. Location determined by user-entered zip code on first use (stored in account or localStorage for guests). No GPS required.

---

### 2. Politician Player Card
A compact, at-a-glance stat block. The quick view. Appears as a bottom sheet when tapping from the feed, or as a standalone page via direct URL.

**Contents:**
- Official photo, full name, party, state, chamber, current term
- **Constituent Grade: A–F (0–100)** — big and bold, letter grade headline, number underneath
- Four quick stats:
  - Attendance % (current session)
  - Stock trades filed (YTD count + total $)
  - Net worth change since taking office
  - Top donor category (e.g., "Finance & Banking")
- Live badge if voted in last 24 hours
- "Full breakdown →" button → opens Politician Halftime screen

---

### 3. Politician Halftime Screen
The full season breakdown. Everything on one scrollable page.

**Sections:**
1. **Constituent Grade breakdown** — letter + number, with sub-scores for each dimension (see Objectivity Engine)
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

## Data Sources

| Source | Data | Update Frequency |
|---|---|---|
| Congress.gov API | Votes, bills, attendance, committee activity | Near real-time |
| FEC API | Campaign contributions, PAC money, donor data | Daily |
| Senate eFD / STOCK Act | Financial disclosures, stock trades | As filed (can lag weeks) |
| ProPublica Congress API | Vote scores, bill history, member profiles | Daily |
| CBO | Bill cost estimates | As published |
| Think tank balance layer | Expert consensus scoring for bill impact — Brookings (center-left), Heritage (right), Cato (libertarian), Urban Institute (center-left), AEI (right). Each org's published position on a bill is fetched or curated manually for major bills, then averaged across the political spectrum to produce a balance score. No single org's framing dominates. | Curated per major bill (100+ bills/year expected) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| State | Zustand (global), useState (local) |
| Backend | Node.js + Express, thin routes, service layer |
| Database | PostgreSQL (managed, Digital Ocean) |
| AI | Anthropic Claude — narration only, structured prompts, prompt caching enabled |
| Auth | Built in from day one (JWT, email/password + social login) |
| Hosting | Digital Ocean App Platform |
| Data ingestion | Scheduled Node.js workers (cron) per data source |

---

## Revenue Model (Flexible)

Revenue is designed to be added without architectural changes. Auth and user accounts are in from day one.

**Potential tiers (to be decided):**
- **Free:** Full access to all public data, politician profiles, bill breakdowns, live ticker
- **Premium:** Real-time alerts (stock trade filed, missed vote, new bill), export data, historical comparisons, "My Reps" dashboard
- **Supporter:** Voluntary donation tier for users who want to fund the mission

**Non-negotiable:** No political advertising. No PAC funding. No sponsored content that could create appearance of bias.

---

## URL Structure

```
/                          → Live ticker feed
/rep/[state]-[name]        → Politician player card
/rep/[state]-[name]/full   → Politician halftime screen
/bill/[congress]-[number]  → Bill halftime screen
/about/methodology         → Public scoring methodology
```

Shareable URLs are a core growth mechanism. Every screen is linkable.

---

## What Makes This Different

1. **One unified display** — not a database to dig through. Everything surfaces in a sports-broadcast rhythm.
2. **The Constituent Grade** — a single auditable number that answers the question voters actually have.
3. **Conflict of interest auto-detection** — no one has to connect the dots manually. The system flags it.
4. **Provable objectivity** — published methodology, cited claims, algorithm-first scoring. Defensible against accusations of bias from any direction.
5. **Shareable** — every politician, every bill, every trade is a link. This is how it grows.
