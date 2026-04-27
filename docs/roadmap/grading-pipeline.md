# Poliscope Grading Pipeline — Roadmap

**Status:** Research complete, implementation not started  
**Research doc:** `docs/research/grading-pipeline.md`  
**Goal:** Produce a real A–F letter grade for every sitting senator and representative based on 5 objective, non-ideological dimensions.

---

## What the grade measures

Transparency and engagement — not ideology. A far-left and a far-right member can both earn an A. The grade rewards showing up, thinking independently, passing bills, taking small-donor money over PAC money, and working across the aisle.

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Attendance** | 30% | % of roll call votes cast (vs. eligible) |
| **Party Independence** | 25% | % of votes cast *against* their own party's majority position |
| **Legislative Effectiveness** | 20% | Bills that advanced past committee + bipartisan cosponsor ratio |
| **Campaign Finance** | 15% | Small-donor % vs. PAC dependency |
| **Bipartisan Engagement** | 10% | Sponsored bills with at least one cosponsor from the other party |

**Grade thresholds:** 90+ = A · 80–89 = B · 70–79 = C · 60–69 = D · below 60 = F

---

## Data sources confirmed working

| Source | Data | Auth | Cost |
|--------|------|------|------|
| Senate.gov XML feed | Senate roll call votes (attendance, positions) | None | Free |
| House Clerk XML / Congress.gov API | House roll call votes | Congress.gov key (have it) | Free |
| Congress.gov API v3 | Sponsored bills, cosponsorships | Key in env | Free |
| FEC OpenAPI | PAC vs. individual contribution totals | Free key needed (api.data.gov) | Free |

**Not building (v1):** STOCK Act disclosures (PDF only, no API, community scrapers broken), ProPublica (shut down July 2024).

---

## Phase 1 — Database schema

**Estimated time:** 1–2 hours  
**Blocks:** everything else

Create the raw vote storage table and extend existing tables:

```sql
-- Raw vote records (source of truth for attendance + party independence)
CREATE TABLE vote_records (
  id            SERIAL PRIMARY KEY,
  member_id     TEXT REFERENCES members(id),
  vote_date     DATE NOT NULL,
  chamber       TEXT NOT NULL,       -- 'senate' | 'house'
  congress      INT NOT NULL,
  session_num   INT NOT NULL,
  vote_number   INT NOT NULL,
  cast          TEXT NOT NULL,       -- 'Yea' | 'Nay' | 'Present' | 'Not Voting'
  party_vote    TEXT,                -- majority party position ('Yea' | 'Nay')
  vote_category TEXT,               -- 'passage' | 'procedural' | 'amendment' | etc.
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (member_id, congress, session_num, vote_number)
);

-- Add FEC ID and score columns
ALTER TABLE members ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT;

ALTER TABLE grade_scores
  ADD COLUMN IF NOT EXISTS legislative_score    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS campaign_finance_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bipartisan_score     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS total_votes_eligible INT,
  ADD COLUMN IF NOT EXISTS votes_cast           INT,
  ADD COLUMN IF NOT EXISTS score_window_start   DATE,
  ADD COLUMN IF NOT EXISTS score_window_end     DATE;
```

**Deliverable:** Migration script at `server/migrations/002_vote_records.sql`, applied to Supabase.

---

## Phase 2 — Senate vote ingest

**Estimated time:** 3–4 hours  
**Blocks:** Senate attendance and party independence scores

Senate.gov publishes all roll call votes as XML. No auth needed.

**Process:**
1. Fetch the vote list: `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_1.xml`
2. For each vote not yet in `vote_records`: fetch individual XML
3. Parse each member's `<vote_cast>` and compute the party majority position from party totals
4. Upsert into `vote_records`
5. Match senators by `last_name + state + party` → `members.id`

**Artifacts:**
- `server/src/workers/ingestSenateVotes.js` — fetches and parses Senate XML
- `api/ingest-senate-votes.js` — Vercel function wrapper (protected by `INGEST_SECRET`)
- Add to `vercel.json` cron: weekly Sunday 3am

**Package needed:** `fast-xml-parser` (add to `server/package.json`)

**Edge cases:**
- Skip procedural votes (quorum calls, adjournment) — filter by `vote_question_text`
- Member name mismatches: two senators share a last name only if different state or party — safe to match on `last_name + state + party`

---

## Phase 3 — House vote ingest

**Estimated time:** 3–4 hours  
**Blocks:** House attendance and party independence scores

Congress.gov API has `/house-vote/{congress}/{session}/{N}/members` — returns JSON with `bioguideID` directly (no name matching needed).

**Process:**
1. Fetch vote list: `GET /house-vote/119/1?limit=250&api_key=KEY`
2. For each vote not yet ingested: `GET /house-vote/119/1/{N}/members`
3. Each record includes `bioguideID`, `voteCast`, `voteParty`, plus the overall vote result
4. Compute party majority position from the party totals in the vote metadata
5. Upsert into `vote_records`

**Artifacts:**
- `server/src/workers/ingestHouseVotes.js`
- `api/ingest-house-votes.js` — Vercel function
- Add to `vercel.json` cron: weekly Sunday 4am (stagger after Senate ingest)

**Rate limit note:** Congress.gov is 5,000 req/hr. The 119th Congress Session 1 has ~362 House votes — 362 member-list requests = safe at any cadence.

---

## Phase 4 — Scoring engine

**Estimated time:** 4–5 hours  
**Blocks:** Grades showing up in the UI

Reads from `vote_records` and `congress.gov` API, writes to `grade_scores`.

**Attendance score:**
```js
const eligible = totalVotes where member was seated
const cast = votes where cast IN ('Yea', 'Nay', 'Present')
attendanceScore = (cast / eligible) * 100
```

**Party independence score:**
```js
const crossoverVotes = votes where cast !== party_vote AND cast IN ('Yea', 'Nay')
const partisanVotes = votes where cast IN ('Yea', 'Nay') AND party_vote IS NOT NULL
partyIndepScore = min((crossoverVotes / partisanVotes) * 500, 100)
// Multiply by 500 because typical crossover rate is 2–15%;
// this scales 20% crossover = 100 points
```

**Legislative effectiveness score:**
```js
// From Congress.gov /member/{id}/sponsored-legislation
const introduced = count(bills where type NOT IN ('HAMDT', 'SAMDT'))
const advanced = count(bills where latestAction.text includes 'Passed' or 'Signed' or 'Became Public Law')
const withCosponsors = count(bills where cosponsors_count > 0)

const advancementRate = advanced / max(introduced, 1)
const cosponsorRate = withCosponsors / max(introduced, 1)
legislativeScore = (advancementRate * 0.6 + cosponsorRate * 0.4) * 100
```

**Bipartisan score:** (computed during legislative pass — see Phase 5 for full cross-party cosponsor detail)
```js
bipartisanScore = min((bipartisanBills / max(introduced, 1)) * 200, 100)
```

**Composite:**
```js
composite = (attendance * 0.30) + (partyIndep * 0.25) +
            (legislative * 0.20) + (finance * 0.15) + (bipartisan * 0.10)

letterGrade = composite >= 90 ? 'A' : composite >= 80 ? 'B' :
              composite >= 70 ? 'C' : composite >= 60 ? 'D' : 'F'

dataSufficient = totalVotes >= 10 && billsIntroduced >= 3
```

**Artifacts:**
- `server/src/workers/computeGrades.js` — pure scoring logic, no side effects
- `api/compute-grades.js` — Vercel function (runs after ingest crons, protected)
- Update `vercel.json` cron: Sunday 5am (after ingest completes)

---

## Phase 5 — FEC campaign finance

**Estimated time:** 2–3 hours  
**Prerequisite:** Free FEC API key from api.data.gov (instant signup)

**One-time FEC ID mapping:**
```
GET https://api.open.fec.gov/v1/candidates/
  ?office=S&state={state}&election_year={currentYear}
  &api_key={FEC_KEY}
```
Match by `name` similarity to `members.last_name` — store `candidate_id` in `members.fec_candidate_id`.

**Monthly finance refresh:**
```
GET https://api.open.fec.gov/v1/candidate/{fec_id}/totals/?cycle={year}
```
Returns: `receipts`, `individual_contributions`, `individual_unitemized_contributions` (small donors < $200), `other_political_committee_contributions` (PAC money).

**Score formula:**
```js
const smallDonorPct = individual_unitemized / max(receipts, 1)
const pacPct = other_political_committee / max(receipts, 1)
financeScore = (smallDonorPct * 0.6 + (1 - pacPct) * 0.4) * 100
```

**Artifacts:**
- `server/src/workers/ingestFEC.js`
- `api/ingest-fec.js` — Vercel function
- `vercel.json` cron: 1st of month, 6am

**Env variable needed:** `FEC_API_KEY` (add to Vercel + `.env.example`)

---

## Phase 6 — UI: grade breakdown in modal

**Estimated time:** 2 hours  
**Blocks:** Users seeing the grades

Update `PlayerPage` to display grades once `data_sufficient = true`:
- Large letter grade badge with animated score reveal on open
- Score breakdown bars for all 5 dimensions (already have `DimensionBar` component)
- "How this is calculated" expandable section with plain-English explanation of each dimension
- Show `score_window_start → score_window_end` so users know what period is scored

---

## Execution order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 (partial, 3 of 5 dimensions) 
      → Phase 5 → Phase 4 (complete all 5 dimensions) → Phase 6
```

You can run Phase 4 after Phase 2+3 with finance_score = null for the first 3 dimensions. Grades will show partial scores until FEC is wired up.

---

## What you need before starting

1. **Free FEC API key** — 5-min signup: https://api.data.gov/signup/  
   → Add as `FEC_API_KEY` in Vercel env vars
2. **No other blockers** — all other APIs are already accessible with existing keys or require no auth

---

## Estimated total build time

| Phase | Hours |
|-------|-------|
| Schema migration | 1–2h |
| Senate vote ingest | 3–4h |
| House vote ingest | 3–4h |
| Scoring engine | 4–5h |
| FEC integration | 2–3h |
| UI grade display | 2h |
| **Total** | **~17–20h** |

With subagent-driven development, most phases run in parallel review cycles and the wall-clock time is significantly lower.
