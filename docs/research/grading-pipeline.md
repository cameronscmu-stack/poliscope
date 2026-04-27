# Poliscope: Grading Pipeline Research

**Researched:** 2026-04-26  
**Domain:** Congressional data APIs, transparency scoring, political accountability metrics  
**Confidence:** HIGH (all APIs live-tested except where noted)

---

## Executive Summary

The ProPublica Congress API — which was the most developer-friendly source for attendance, missed votes, and party alignment stats — **shut down in July 2024 and is no longer available**. New API keys cannot be issued. This is the single most important finding in this document.

The good news: three high-quality alternatives cover all the same grounding data:

1. **Congress.gov API v3** — already integrated; now has beta House roll call vote endpoints (as of May 2025) with member-level vote records. Senate votes require the `senate.gov` XML feed.
2. **Senate.gov and House Clerk XML feeds** — free, no auth, machine-readable, member-level vote data. The canonical source for attendance and party alignment computation.
3. **FEC API** — free with key, 1000 req/hr, financial totals and PAC/individual contribution breakdowns.

STOCK Act disclosures (both Senate and House) are available only as PDFs or via HTML search forms. No official JSON APIs exist. Community-sourced GitHub repositories have degraded (403 errors as of early 2026). Third-party paid APIs are available but not recommended for MVP.

**Primary recommendation:** Build the ingest pipeline on Congress.gov API v3 + senate.gov XML + clerk.house.gov XML + FEC. Skip STOCK Act disclosures for v1 — too fragile and too much ETL for limited scoring value.

---

## Data Sources

---

### 1. ProPublica Congress API

| Property | Value |
|----------|-------|
| URL | `https://projects.propublica.org/represent/` |
| Status | **SHUT DOWN — July 2024** |
| Cost | Was free with API key |
| Auth | X-API-Key header |
| Rate Limits | Was 5,000 req/day |
| New Keys | Not available |

**What it provided (historical reference):**
- `missed_votes_pct` — percentage of votes missed, pre-computed
- `votes_with_party_pct` — percentage voting with party majority, pre-computed
- `votes_against_party_pct` — pre-computed crossover metric
- Member vote-by-vote history

**Why it mattered:** ProPublica did the heavy computation (party alignment, missed vote %) server-side. We now have to compute these ourselves from raw roll call data.

**Vercel compatibility:** N/A — API is offline.

**Recommendation:** Remove `PROPUBLICA_API_KEY` from `.env` files. This source is gone.

---

### 2. Congress.gov API v3

| Property | Value |
|----------|-------|
| URL | `https://api.congress.gov/v3` |
| Status | Live, actively maintained by Library of Congress |
| Cost | Free |
| Auth | `api_key` query param or `X-Api-Key` header |
| Rate Limits | 5,000 requests/hour |
| Key Source | `https://api.congress.gov` — free registration |
| Existing Key | `CONGRESS_API_KEY` in project `.env` |

**Live-tested endpoints:**

| Endpoint | Data | Notes |
|----------|------|-------|
| `GET /member/{bioguideId}` | Bio, terms, party history, office contact | Confirmed working |
| `GET /member/{bioguideId}/sponsored-legislation` | All bills/amendments sponsored, with action dates | Confirmed — Booker has 1,001 entries |
| `GET /member/{bioguideId}/cosponsored-legislation` | All cosponsorships | Confirmed |
| `GET /house-vote/{congress}/{session}/{rollCallNumber}` | Full vote metadata, party totals | Confirmed — returns `result`, `voteQuestion`, party breakdowns |
| `GET /house-vote/{congress}/{session}/{rollCallNumber}/members` | **Every House member's vote** — `bioguideID`, `voteCast` (Yea/Nay/Not Voting/Present), `voteParty`, `voteState` | Confirmed |
| `GET /house-vote/{congress}/{session}` | Vote list for a full session — 362 votes in 119th Congress Session 1 so far | Confirmed |

**Critical gap — Senate votes:** The `senate-vote` endpoint does **not** exist yet in the API. Tested and confirmed `{"error": "Unknown resource: senate-vote"}`. Senate XML feed is the workaround (see Section 4).

**Bill passage rate computation:** The `/sponsored-legislation` endpoint returns `latestAction` text. Checking for "Became Public Law" or "Signed by President" in `latestAction.text` allows computing a passage rate. This requires parsing ~1,000 items per prolific sponsor — manageable in a cron job with pagination.

**Vercel compatibility:** Fully compatible. No CORS issues, responds in < 200ms per request. Rate limit (5,000/hr) is not a concern for batch cron jobs. For real-time member profile calls, a single member page makes 2-3 API calls — well within limits.

**Cron suitability:** High. Paginated design supports walking all House votes for a congress session to build local attendance tables.

**Score dimensions enabled:**
- Attendance (House only — via `/house-vote/.../members`)
- Bill sponsorship volume
- Bill passage rate (proxy for legislative effectiveness)
- Bipartisan cosponsor count (requires iterating cosponsors and checking party of each cosponsor)

---

### 3. Senate.gov Roll Call Vote XML Feed

| Property | Value |
|----------|-------|
| URL | `https://www.senate.gov/legislative/LIS/roll_call_votes/` |
| Status | Live, official government source |
| Cost | Free |
| Auth | None required |
| Rate Limits | Not published; behaves like a static file server — very permissive |
| Format | XML |
| Update Frequency | After each roll call vote — near real-time |

**Confirmed endpoints (live-tested):**

```
# Vote list for a session
https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml

# Individual vote with member-level records
https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{voteNumber}.xml
```

**Example:** `vote_119_1_00001.xml` returns:
- `<congress>`, `<session>`, `<vote_date>`, `<vote_question_text>`, `<vote_result_text>`
- `<count>` with `<yeas>`, `<nays>`, `<absent>`
- `<members>` array — each member has: `<last_name>`, `<first_name>`, `<party>`, `<state>`, `<vote_cast>` (Yea / Nay / Not Voting / Present), `<lis_member_id>`

**Vote count:** The 119th Congress Session 1 vote list shows vote 00659 as the latest — approximately 659 Senate roll call votes so far.

**Name-to-bioguide matching:** The XML uses `lis_member_id` (e.g., `S428`), not bioguide IDs. Matching requires a lookup table mapping LIS IDs or (last_name + state + party) to bioguide IDs. The `unitedstates/congress` GitHub project maintains this mapping. Alternatively, match by `last_name + state + party` which is unambiguous for current members.

**Vercel compatibility:** Fully compatible. Static XML served from senate.gov. No CORS headers needed for server-side fetch.

**Cron suitability:** High. Walk vote list, fetch each XML, parse with a simple XML parser (Node's built-in `DOMParser` or `fast-xml-parser` npm package). For a full-session refresh: ~659 requests for Senate Session 1 of the 119th Congress.

**Score dimensions enabled:** Attendance, party alignment (for Senate members)

---

### 4. House Clerk Roll Call Vote XML Feed

| Property | Value |
|----------|-------|
| URL | `https://clerk.house.gov/evs/{year}/` |
| Status | Live, official government source |
| Cost | Free |
| Auth | None required |
| Format | XML |
| Update Frequency | Near real-time after each vote |

**Confirmed endpoints:**

```
# Individual vote XML (sourceDataURL from Congress.gov API)
https://clerk.house.gov/evs/2025/roll{NNN}.xml
```

**Example response structure (confirmed):**
- `<rollcall-num>`, `<vote-question>`, `<vote-result>`, `<action-date>`
- `<vote-data>` array — each `<recorded-vote>` contains `<legislator name-id="bioguideId" party="D/R" state="XX">` + `<vote>` (Yea / Nay / Present / Not Voting)

**Critical advantage:** The `name-id` attribute in the House XML **is** the bioguide ID directly (e.g., `A000370`). No mapping table needed for House members.

**Note:** The Congress.gov API `/house-vote/.../members` endpoint provides the same data in JSON — use the API for simplicity if the rate limit permits, fall back to XML for bulk historical loads.

**Cron suitability:** High. The `sourceDataURL` field in each Congress.gov house-vote response points directly to the XML.

---

### 5. FEC API (OpenFEC)

| Property | Value |
|----------|-------|
| URL | `https://api.open.fec.gov/v1/` |
| Status | Live |
| Cost | Free |
| Auth | `api_key` query param. DEMO_KEY: **40 req/hr**. Free personal key (api.data.gov signup): **1,000 req/hr** |
| Key Signup | `https://api.data.gov/signup/` — instant, no approval |
| Rate Limits (confirmed) | DEMO_KEY: 40/hr. Personal key: 1,000/hr. Upgraded: 120/min |
| Data Freshness | Nightly updates |

**Live-tested endpoints:**

| Endpoint | Data | Notes |
|----------|------|-------|
| `GET /candidate/?office=S&office=H` | Basic candidate info — `candidate_id`, party, state, cycles active | Returns all historical candidates, not just current incumbents |
| `GET /candidate/{candidate_id}/totals/?cycle={year}` | **Full financial summary** — `receipts`, `contributions`, `individual_contributions`, `individual_itemized_contributions`, `other_political_committee_contributions` (PAC money), `last_cash_on_hand_end_period`, `disbursements` | Confirmed working — Booker 2024 cycle: $7.9M receipts, $16.5K PAC money |

**Key fields for grading:**

```json
{
  "receipts": 7919520.16,
  "individual_contributions": 4233671.15,
  "individual_itemized_contributions": 1922219.24,
  "individual_unitemized_contributions": 2311451.91,
  "other_political_committee_contributions": 16510.00,   // PAC money
  "political_party_committee_contributions": 0.0,
  "last_cash_on_hand_end_period": 11192485.99
}
```

**Candidate ID lookup challenge:** FEC `candidate_id` (e.g., `S4NJ00185`) is not stored in the existing `members` table. Matching requires a one-time lookup via `GET /candidates/?name={last_name}&office=S` or `GET /candidates/?office=S&state={state}&cycle={year}` and then storing the `candidate_id` in the `members` table.

**Alternative:** The `unitedstates/congress-legislators` YAML files include FEC IDs cross-referenced to bioguide IDs. This is the cleanest matching approach.

**Vercel compatibility:** Fully compatible. Rate limit of 1,000/hr with a personal key is sufficient for a daily cron job that processes ~535 current members.

**Score dimensions enabled:**
- PAC money dependency (ratio of PAC contributions to total contributions)
- Fundraising independence (high individual small-dollar donors = more independent)
- Cash on hand (signal of electoral security and donor base)

**What it does NOT provide:**
- Vote history, attendance, or legislative activity
- Conflict-of-interest stock trades (that's STOCK Act)

---

### 6. Senate STOCK Act Disclosures (efdsearch.senate.gov)

| Property | Value |
|----------|-------|
| URL | `https://efdsearch.senate.gov/search/home/` |
| Status | Live as a search UI only |
| API Status | **No official JSON API exists** |
| Format | HTML search form + PDF documents |
| Auth | None for public viewing |

**What's available:**
- Periodic Transaction Reports (PTRs) filed within 45 days of a stock trade exceeding $1,000
- Annual Financial Disclosure Reports
- Searchable by senator name, date range, report type

**Developer reality:** The efdsearch.senate.gov platform does not expose a REST API. The community project `timothycarambat/senate-stock-watcher-data` (GitHub) maintained a JSON dataset scraped from this source, but it has not been updated since mid-2025. The S3-hosted version of the data returns 403 errors as of early 2026.

**Available workarounds (none recommended for MVP):**
1. Scrape HTML from `efdsearch.senate.gov/search/` with `Playwright` or `Puppeteer` — fragile, may break with site changes, legal grey area depending on TOS
2. Use a paid third-party: Financial Modeling Prep Senate Trading API, Lambda Finance congressional trading endpoint, Finnhub congressional trading API — all require paid plans
3. Parse individual PTR PDFs — requires PDF-to-text extraction, extremely brittle

**Vercel compatibility:** Not applicable — no API.

**Recommendation:** **Skip for v1.** The ETL complexity and fragility far outweigh the scoring value for a minimum viable grading system. Add a `stock_trades_score` column to `grade_scores` and leave it `NULL` until a reliable source is established.

---

### 7. House STOCK Act Disclosures (disclosures-clerk.house.gov)

| Property | Value |
|----------|-------|
| URL | `https://disclosures-clerk.house.gov/FinancialDisclosure` |
| Status | Live as a search UI + PDF repository |
| API Status | **No official JSON API exists** |
| Format | ASPX search form + PDF documents |

**Bulk download option:** The House Clerk site has a ZIP download for annual Financial Disclosure Reports. PTR data is available as individual PDFs at `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{filingId}.pdf`. No bulk PTR dataset is published in structured format.

**Same limitations as Senate:** No API. PDFs only. Community scrapers have degraded.

**Recommendation:** Same as Senate — **skip for v1.**

---

### 8. GovTrack.us API

| Property | Value |
|----------|-------|
| URL | `https://www.govtrack.us/api/v2/` |
| Status | Live |
| Cost | Free |
| Auth | None required |
| Rate Limits | Not published — behaves generously, no documented limit |
| Format | JSON |

**Live-tested endpoints:**

| Endpoint | Data | Notes |
|----------|------|-------|
| `GET /api/v2/person/?q={name}` | Person lookup — bioguide ID, GovTrack person ID, osid (OpenSecrets ID), CSPAN ID | Confirmed. Person search by `q` works. Cannot filter by `bioguideid` directly (returns 400). |
| `GET /api/v2/role/?current=true&role_type=senator` | All current senators with GovTrack person IDs, party, state | Confirmed — 100 total senators |
| `GET /api/v2/vote_voter/?person={govtrackId}` | Every recorded vote for a person — `option.value` (Yea/Nay/Present/Not Voting), vote metadata | Confirmed working — Susan Collins has 9,958 recorded votes |
| `GET /api/v2/vote/?congress={N}` | All votes in a congress — category, chamber, passed/failed, party uniformity | Confirmed — 1,263 votes in 119th Congress |

**Key insight:** GovTrack `person` IDs are **not** bioguide IDs. The `person` object in API responses includes `bioguideid`, enabling cross-referencing. The cleanest approach: fetch all current roles (`/role/?current=true`) to build a GovTrack_id → bioguide_id lookup table, then use `vote_voter` for attendance and voting history.

**What GovTrack adds that Congress.gov doesn't:**
- Senate vote history (via `vote_voter`) — fills the gap where Congress.gov has no Senate vote endpoint
- `vote.category` field (procedural / passage-military / passage-suspension / amendment / etc.) — useful for filtering to substantive votes only
- `vote.party_uniformity` — pre-computed party unity metric (when available)

**Vercel compatibility:** Fully compatible. Public API, no auth, fast responses.

**Cron suitability:** High, but no published rate limit — implement exponential backoff as a precaution.

**Score dimensions enabled:** Attendance (both chambers), party alignment (via majority party vote vs. individual vote matching), bipartisan vote identification

---

### 9. VoteSmart.org API

| Property | Value |
|----------|-------|
| URL | `https://api.votesmart.org/docs/` |
| Status | Live |
| Cost | Free for non-commercial/journalistic use; commercial use requires contact |
| Auth | API key required (apply via webmaster@votesmart.org) |
| Rate Limits | Not published |

**What it provides:**
- Candidate biographies and positions
- Interest group ratings (NRA, AFL-CIO, Chamber of Commerce grades for each member)
- Public statements
- Voting records (separate from official roll call records)

**Score dimensions:** Interest group ratings could serve as a "third-party accountability" dimension, but the data is uneven across members and adds complexity without proportional value.

**Recommendation:** Low priority for v1. The interest group ratings are ideologically loaded and would require careful framing to avoid making Poliscope appear partisan.

---

## Composite Scoring Formula

### The Five Dimensions

| # | Dimension | Weight | Data Source | Description |
|---|-----------|--------|-------------|-------------|
| 1 | Attendance | 30% | Senate XML / House Clerk XML / Congress.gov API | Percentage of votes cast (Yea, Nay, Present) out of total votes while in office |
| 2 | Party Independence | 25% | Senate XML / House Clerk XML / GovTrack | Percentage of votes cast **against** their party's majority position |
| 3 | Legislative Effectiveness | 20% | Congress.gov API | Bills sponsored that advanced past committee + bipartisan cosponsor ratio |
| 4 | Campaign Finance Transparency | 15% | FEC API | Ratio of small-dollar individual contributions to total receipts; PAC dependency |
| 5 | Bipartisan Engagement | 10% | Congress.gov API | Percentage of sponsored bills with at least one cosponsor from the opposite party |

**Rationale for weights:**
- Attendance is the most objectively neutral metric — showing up is the baseline job
- Party independence rewards legislators who exercise independent judgment
- Legislative effectiveness captures actual output beyond attendance
- Campaign finance reflects who a member is accountable to
- Bipartisan engagement is a downstream signal of independence, weighted lower to avoid penalizing members in highly polarized chambers

---

### Formulas Per Dimension

#### Dimension 1: Attendance Score (0–100)

```
votes_cast = count of votes where cast ∈ ('Yea', 'Nay', 'Present')
total_votes = count of votes while member was in current session
raw_pct = votes_cast / total_votes

attendance_score = raw_pct * 100
```

**Normalization note:** Members on medical leave or running for other office have inflated absences. Apply a flag `data_sufficient = false` if `total_votes < 10` for the calculation window. Do NOT penalize for absences when excused (this data is not machine-readable, so treat as a known limitation).

**Typical ranges (per GovTrack 2024 data):**
- 95–100% = A (typical for most members)
- 85–94% = B
- 70–84% = C  
- Below 70% = D/F (presidential candidates, members with health issues)

#### Dimension 2: Party Independence Score (0–100)

```
For each vote V where member voted Yea or Nay:
  party_majority = the Yea/Nay position taken by >50% of their party's voting members

crossover_votes = count of votes where member_vote ≠ party_majority
total_partisan_votes = count of all Yea/Nay votes cast

raw_crossover_pct = crossover_votes / total_partisan_votes

party_independence_score = min(raw_crossover_pct * 500, 100)
```

**Why multiply by 500:** Typical crossover rates range from 2–15% even for notably independent members. Scaling so that 20% crossover = 100 means the distribution uses the full range. Calibrate this multiplier against real data — check GovTrack's 2024 report cards as a benchmark.

**Exclude:** Procedural votes (quorum calls, adjournment motions). Use vote `category` from GovTrack or `voteType` from the XML to filter.

#### Dimension 3: Legislative Effectiveness Score (0–100)

```
bills_introduced = count of bills/resolutions sponsored (not amendments)
bills_advanced = count where latestAction contains 'Passed' or 'Signed' or 'Became Law'
bipartisan_bills = count of sponsored bills with ≥1 cosponsor from opposite party

advancement_rate = bills_advanced / max(bills_introduced, 1)
bipartisan_rate = bipartisan_bills / max(bills_introduced, 1)

raw_score = (advancement_rate * 0.6) + (bipartisan_rate * 0.4)

legislative_score = raw_score * 100
```

**Data gap:** The `cosponsors` field in sponsored legislation from Congress.gov API includes cosponsor count but not party breakdown. Getting bipartisan_rate requires fetching the cosponsors sub-endpoint for each bill — expensive. For v1, use `cosponsors_count > 0` as a proxy.

**Minimum bills required:** Set `data_sufficient = false` if `bills_introduced < 5`. Freshmen members in their first year often have < 5 bills.

#### Dimension 4: Campaign Finance Transparency Score (0–100)

```
pac_contributions = other_political_committee_contributions (from FEC totals)
total_receipts = receipts
individual_small = individual_unitemized_contributions  // <$200 donations
individual_total = individual_contributions

pac_pct = pac_contributions / max(total_receipts, 1)
small_donor_pct = individual_small / max(total_receipts, 1)

// Higher PAC % = lower score; higher small-donor % = higher score
raw_score = (small_donor_pct * 0.6) + ((1 - pac_pct) * 0.4)

campaign_finance_score = raw_score * 100
```

**Edge case:** Senators not up for election in the cycle may have very low fundraising. Check `coverage_end_date` on the FEC totals — use the most recent 2-year cycle window for the relevant election year.

#### Dimension 5: Bipartisan Engagement Score (0–100)

```
bills_with_crossparty_cosponsor = count of sponsored bills where 
  ≥1 cosponsor has a different party affiliation

total_bills = bills_introduced (same as Dimension 3)

bipartisan_rate = bills_with_crossparty_cosponsor / max(total_bills, 1)

bipartisan_score = min(bipartisan_rate * 200, 100)
```

**Note:** Can be computed simultaneously with Dimension 3 in the same data pass.

---

### Composite Score and Grade

```
composite_score = (
  (attendance_score    * 0.30) +
  (party_indep_score   * 0.25) +
  (legislative_score   * 0.20) +
  (finance_score       * 0.15) +
  (bipartisan_score    * 0.10)
)
```

**Grade thresholds:**

| Score | Grade | Label |
|-------|-------|-------|
| 90–100 | A | Exceptional |
| 80–89 | B | Above Average |
| 70–79 | C | Average |
| 60–69 | D | Below Average |
| 0–59 | F | Poor |

**Important framing note:** These grades are designed to measure transparency and engagement metrics — not ideology or policy positions. A far-left and far-right member can both earn an A. A member with perfect attendance, no PAC money, and bipartisan bills would score high regardless of party. Build this framing into the UI.

---

## Data Ingest Architecture

### Recommended Cron Job Structure

```
Weekly cron (Sunday 2am):
  1. Ingest House votes from Congress.gov API
     - GET /house-vote/{congress}/{session} → paginate all votes
     - For each vote: GET /house-vote/{congress}/{session}/{N}/members
     - Upsert into vote_records table (member_id, vote_date, cast, party_majority)
  
  2. Ingest Senate votes from senate.gov XML
     - GET /legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml
     - Compare vote numbers against last ingested vote number
     - For each new vote: GET individual vote XML
     - Parse and upsert
  
  3. Compute grade scores
     - For each current member: compute all 5 dimensions
     - Upsert grade_scores table

Monthly cron (1st of month):
  4. Refresh FEC financial data
     - For each senator up for election in current/next cycle
     - GET /candidate/{fec_id}/totals/?cycle={year}
     - Update finance_score dimension
```

### Suggested Additional Tables

```sql
-- Store raw vote records for score recomputation
CREATE TABLE vote_records (
  id            SERIAL PRIMARY KEY,
  member_id     TEXT REFERENCES members(id),
  vote_date     TIMESTAMPTZ,
  chamber       TEXT,     -- 'house' | 'senate'
  vote_number   INT,
  congress      INT,
  session_num   INT,
  cast          TEXT,     -- 'Yea' | 'Nay' | 'Present' | 'Not Voting'
  party_vote    TEXT,     -- majority party position on this vote
  vote_category TEXT,     -- 'procedural' | 'passage' | etc.
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Store FEC candidate ID mapping
ALTER TABLE members ADD COLUMN fec_candidate_id TEXT;

-- Store computed score breakdown for debuggability
ALTER TABLE grade_scores ADD COLUMN legislative_score NUMERIC(5,2);
ALTER TABLE grade_scores ADD COLUMN campaign_finance_score NUMERIC(5,2);
ALTER TABLE grade_scores ADD COLUMN bipartisan_score NUMERIC(5,2);
ALTER TABLE grade_scores ADD COLUMN total_votes_available INT;
ALTER TABLE grade_scores ADD COLUMN votes_cast INT;
```

---

## Critical Implementation Notes

### Senate XML Name Matching

The Senate XML uses `<lis_member_id>` (e.g., `S428`) rather than bioguide IDs. The cleanest resolution:

1. Cross-reference `last_name + state + party` against the `members` table — unambiguous for current members
2. Or fetch the `unitedstates/congress-legislators` YAML from GitHub once and build a `lis_id → bioguide_id` lookup table

### FEC Candidate ID Gap

The current `members` table does not have FEC candidate IDs. Required one-time migration:

```javascript
// Lookup by name + office + state
GET /candidates/?name={lastName}&office={S|H}&state={stateAbbr}&api_key={key}
// Store the matching candidate_id in members.fec_candidate_id
```

Senators run statewide; House members by district. Some members have multiple FEC candidate IDs across election cycles — use the most recent `active_through` cycle.

### Party Majority Vote Computation

The roll call XML includes party-level totals (`yeas`, `nays` per party). Computing party majority:

```javascript
function partyMajorityPosition(memberParty, voteData) {
  const partyVotes = voteData.partyTotals[memberParty]
  return partyVotes.yeas > partyVotes.nays ? 'Yea' : 'Nay'
  // If tied: no clear majority — exclude this vote from party independence calculation
}
```

### Handling `data_sufficient = false`

The existing `grade_scores.data_sufficient` column should be set to `false` when:
- Member has been in office less than 90 days (new member)
- Fewer than 10 total votes were available in the calculation window
- FEC data is missing or covers < 6 months of the election cycle

---

## Vercel Serverless Considerations

| Concern | Assessment |
|---------|------------|
| Congress.gov rate limit | 5,000/hr — safe for real-time profile lookups (2-3 calls per page view) |
| Senate.gov XML | No rate limit published, static file server — low risk |
| House Clerk XML | No rate limit published — low risk |
| FEC API | 1,000/hr with personal key — fine for cron, not real-time |
| GovTrack API | No published limit — add exponential backoff |
| CORS | All sources are server-fetched (API routes) — CORS not relevant |
| Timeout | Vercel serverless has 10s default (60s on Pro). Cron-style ingest must paginate across multiple invocations. Consider splitting into smaller per-member tasks with a queue (Vercel Cron + Supabase queue pattern) |
| Cold starts | Not relevant for cron jobs |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| Congress.gov API key | Vote ingest, member data | Yes | `CONGRESS_API_KEY` in env |
| FEC API key | Campaign finance scores | No | DEMO_KEY is 40/hr — too slow for 535 members. Register free personal key at api.data.gov/signup |
| ProPublica API key | Attendance/party data | No | API is shut down. Remove `PROPUBLICA_API_KEY` from env |
| Supabase/Postgres | Score storage | Yes | `DATABASE_URL` in env |
| `fast-xml-parser` npm | Senate/House XML parsing | Not installed | Add to server package.json |

---

## What to Build vs. What to Skip

### Build for v1

- Senate XML + House Clerk XML ingest for attendance + party independence
- Congress.gov API for bill sponsorship and legislative effectiveness
- FEC API for campaign finance score (requires free personal key)
- Composite scoring engine with all 5 dimensions

### Skip for v1

- STOCK Act disclosures (no reliable free API; ETL complexity high, scoring value low)
- VoteSmart interest group ratings (ideologically loaded, adds framing complexity)
- GovTrack as primary source (use as supplement/validation, not primary — senate.gov XML is more authoritative)
- DW-NOMINATE ideology scores (these measure ideology, not accountability)

---

## Sources

### Primary (HIGH confidence — live tested)
- Congress.gov API v3 — `api.congress.gov` — house-vote endpoint, member endpoint, sponsored legislation
- Senate.gov XML feed — `senate.gov/legislative/LIS/roll_call_votes/` — vote list and individual vote records
- House Clerk XML feed — `clerk.house.gov/evs/{year}/roll{N}.xml` — individual vote records
- FEC OpenAPI — `api.open.fec.gov/v1/` — candidate totals, contribution breakdowns

### Secondary (HIGH confidence — source confirmed shutdown)
- ProPublica Congress API shutdown announcement — `projects.propublica.org/represent/` — confirmed defunct July 2024

### Secondary (MEDIUM confidence — live tested, less critical)
- GovTrack API v2 — `govtrack.us/api/v2/` — vote, vote_voter, role, person endpoints
- FEC DEMO_KEY rate limit — confirmed: 40 req/hr by hitting the limit during testing

### Tertiary (MEDIUM confidence — WebSearch, not personally verified)
- `yourreprecord.org/how-we-score/` — methodology confirmed uses Congress.gov API + FEC bulk data
- `github.com/timothycarambat/senate-stock-watcher-data` — STOCK Act JSON data, reported 403 errors as of early 2026
- VoteSmart API — docs accessible at `api.votesmart.org/docs/` but could not verify rate limits without a key
