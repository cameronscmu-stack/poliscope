# Poliscope Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Poliscope app with real congressional data — every member ingested, attendance and party independence grades calculated, a REST API serving them, and a React frontend showing a clickable seat grid and basic Player Page.

**Architecture:** Monorepo with `client/` (React + Vite + Tailwind) and `server/` (Node.js + Express). PostgreSQL is the single source of truth — never live API calls in request paths. A ProPublica ingestion worker populates the DB on a schedule. Grade calculation runs after each ingestion pass.

**Tech Stack:** React 18, Vite, Tailwind CSS, React Router v6, Node.js 18+, Express 4, PostgreSQL, node-cron, ProPublica Congress API

**Phase 1 scope (2 of 5 grade dimensions):**
- Attendance Score = `100 - missed_votes_pct`
- Party Independence Score = `100 - votes_with_party_pct`
- Composite = average of the two

Full 5-dimension grade arrives in Phase 3 when FEC and STOCK Act data pipelines are built.

---

## File Structure

```
poliscope/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css                  ← design tokens (CSS custom properties)
│       ├── pages/
│       │   ├── Home.jsx               ← chamber toggle + grid
│       │   └── Rep.jsx                ← wraps PlayerPage, fetches member by id
│       ├── components/
│       │   ├── ChamberGrid/
│       │   │   ├── ChamberGrid.jsx    ← renders all seats in a responsive grid
│       │   │   └── ChamberGrid.test.jsx
│       │   ├── SeatDot/
│       │   │   ├── SeatDot.jsx        ← single seat button with party color + grade glow
│       │   │   └── SeatDot.test.jsx
│       │   └── PlayerPage/
│       │       ├── PlayerPage.jsx     ← member profile card
│       │       └── PlayerPage.test.jsx
│       └── hooks/
│           └── useMembers.js          ← fetch + poll /api/members
├── server/
│   ├── package.json
│   ├── vitest.config.js
│   └── src/
│       ├── index.js                   ← starts server, binds port
│       ├── app.js                     ← Express factory (exported for tests)
│       ├── db/
│       │   ├── client.js              ← pg Pool singleton
│       │   ├── migrate.js             ← migration runner (CLI)
│       │   └── migrations/
│       │       ├── 001_members.sql
│       │       ├── 002_votes.sql
│       │       ├── 003_attendance.sql
│       │       └── 004_grade_scores.sql
│       ├── routes/
│       │   └── members.js             ← GET /api/members, GET /api/members/:id
│       ├── services/
│       │   ├── memberService.js       ← DB queries for member data
│       │   └── gradeService.js        ← pure functions: score calculations
│       └── workers/
│           ├── fetchMembers.js        ← ProPublica ingestion + upsert
│           └── scheduler.js           ← node-cron orchestrator
├── .env.example
└── .gitignore                         ← already exists
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root workspace)
- Create: `server/package.json`
- Create: `.env.example`

- [ ] **Step 1: Write the root package.json**

```json
{
  "name": "poliscope",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "client",
    "server"
  ],
  "scripts": {
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client"
  }
}
```

Save to: `package.json`

- [ ] **Step 2: Write server/package.json**

```json
{
  "name": "@poliscope/server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "migrate": "node src/db/migrate.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "node-cron": "^3.0.3",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^1.6.0"
  }
}
```

Save to: `server/package.json`

- [ ] **Step 3: Write .env.example**

```
DATABASE_URL=postgres://postgres:password@localhost:5432/poliscope
PROPUBLICA_API_KEY=your_propublica_api_key_here
PORT=3001
```

Save to: `.env.example`

Copy to `.env` and fill in real values before running anything.

- [ ] **Step 4: Scaffold the Vite client**

Run from the `poliscope/` root:

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
npm create vite@latest client -- --template react
```

When prompted: select "React" → "JavaScript".

- [ ] **Step 5: Install server dependencies**

```bash
cd server && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Install client dependencies + Tailwind**

```bash
cd ../client
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom zustand
```

Expected: `tailwind.config.js` and `postcss.config.js` created.

- [ ] **Step 7: Configure tailwind.config.js**

Replace the generated `client/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 8: Commit scaffold**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add .
git commit -m "Scaffold monorepo: Vite client + Express server"
```

---

## Task 2: Database Schema

**Files:**
- Create: `server/src/db/client.js`
- Create: `server/src/db/migrate.js`
- Create: `server/src/db/migrations/001_members.sql`
- Create: `server/src/db/migrations/002_votes.sql`
- Create: `server/src/db/migrations/003_attendance.sql`
- Create: `server/src/db/migrations/004_grade_scores.sql`

- [ ] **Step 1: Write the DB connection pool**

```js
// server/src/db/client.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
```

- [ ] **Step 2: Write migration 001 — members table**

```sql
-- server/src/db/migrations/001_members.sql
CREATE TABLE IF NOT EXISTS members (
  id          VARCHAR(10)  PRIMARY KEY,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  party       CHAR(1)      NOT NULL,
  state       CHAR(2)      NOT NULL,
  chamber     VARCHAR(6)   NOT NULL CHECK (chamber IN ('senate', 'house')),
  district    SMALLINT,
  in_office   BOOLEAN      DEFAULT true,
  photo_url   TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
```

- [ ] **Step 3: Write migration 002 — votes table**

```sql
-- server/src/db/migrations/002_votes.sql
CREATE TABLE IF NOT EXISTS votes (
  id              SERIAL      PRIMARY KEY,
  member_id       VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE,
  bill_id         VARCHAR(50),
  roll_call_number INTEGER,
  congress        SMALLINT,
  session         SMALLINT,
  chamber         VARCHAR(6),
  vote_date       DATE,
  vote_position   VARCHAR(20),
  party_position  VARCHAR(20),
  bill_title      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_member_id ON votes(member_id);
CREATE INDEX IF NOT EXISTS idx_votes_vote_date ON votes(vote_date);
```

- [ ] **Step 4: Write migration 003 — attendance table**

```sql
-- server/src/db/migrations/003_attendance.sql
CREATE TABLE IF NOT EXISTS attendance_records (
  id              SERIAL      PRIMARY KEY,
  member_id       VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE UNIQUE,
  congress        SMALLINT,
  total_votes     INTEGER     DEFAULT 0,
  votes_cast      INTEGER     DEFAULT 0,
  missed_votes    INTEGER     DEFAULT 0,
  attendance_pct  DECIMAL(5,2),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 5: Write migration 004 — grade scores table**

```sql
-- server/src/db/migrations/004_grade_scores.sql
CREATE TABLE IF NOT EXISTS grade_scores (
  id                        SERIAL      PRIMARY KEY,
  member_id                 VARCHAR(10) REFERENCES members(id) ON DELETE CASCADE UNIQUE,
  attendance_score          DECIMAL(5,2),
  party_independence_score  DECIMAL(5,2),
  composite_score           DECIMAL(5,2),
  letter_grade              CHAR(1),
  data_sufficient           BOOLEAN     DEFAULT false,
  calculated_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 6: Write the migration runner**

```js
// server/src/db/migrate.js
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id       SERIAL       PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        run_at   TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM _migrations');
    const ran = new Set(rows.map(r => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (ran.has(file)) { console.log(`  skip ${file}`); continue; }
      console.log(`  running ${file}...`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓ ${file}`);
    }
    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 7: Run migrations**

Make sure `.env` has a valid `DATABASE_URL` pointing to a local or managed PostgreSQL instance. Create the database first if it doesn't exist:

```bash
createdb poliscope
```

Then run:

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server
npm run migrate
```

Expected output:
```
  running 001_members.sql...
  ✓ 001_members.sql
  running 002_votes.sql...
  ✓ 002_votes.sql
  running 003_attendance.sql...
  ✓ 003_attendance.sql
  running 004_grade_scores.sql...
  ✓ 004_grade_scores.sql
Migrations complete.
```

- [ ] **Step 8: Commit migrations**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add server/src/db/
git commit -m "Add database schema migrations for members, votes, attendance, grades"
```

---

## Task 3: Express App + Health Check

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/index.js`
- Create: `server/vitest.config.js`
- Create: `server/src/app.test.js`

- [ ] **Step 1: Write the failing test for health check**

```js
// server/src/app.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 2: Write vitest.config.js**

```js
// server/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Run the test — verify it fails**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server
npm test
```

Expected: FAIL — `Cannot find module './app.js'`

- [ ] **Step 4: Write the Express app factory**

```js
// server/src/app.js
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
```

- [ ] **Step 5: Run the test — verify it passes**

```bash
npm test
```

Expected: PASS — `GET /health › returns 200 with status ok`

- [ ] **Step 6: Write the server entry point**

```js
// server/src/index.js
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Poliscope server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 7: Smoke-test the server**

```bash
node src/index.js &
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}`

Kill the server: `kill %1`

- [ ] **Step 8: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add server/src/app.js server/src/index.js server/src/app.test.js server/vitest.config.js
git commit -m "Add Express app factory with health check"
```

---

## Task 4: Grade Service

**Files:**
- Create: `server/src/services/gradeService.js`
- Create: `server/src/services/gradeService.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// server/src/services/gradeService.test.js
import { describe, it, expect } from 'vitest';
import {
  calculateAttendanceScore,
  calculatePartyIndependenceScore,
  calculateCompositeScore,
  letterGrade,
} from './gradeService.js';

describe('calculateAttendanceScore', () => {
  it('returns 100 minus missed_votes_pct', () => {
    expect(calculateAttendanceScore(5)).toBe(95);
  });
  it('returns 0 when missed_votes_pct is 100', () => {
    expect(calculateAttendanceScore(100)).toBe(0);
  });
  it('clamps to 0 for values above 100', () => {
    expect(calculateAttendanceScore(120)).toBe(0);
  });
  it('clamps to 100 for negative values', () => {
    expect(calculateAttendanceScore(-5)).toBe(100);
  });
});

describe('calculatePartyIndependenceScore', () => {
  it('returns 100 minus votes_with_party_pct', () => {
    expect(calculatePartyIndependenceScore(90)).toBe(10);
  });
  it('returns 100 when member never votes with party', () => {
    expect(calculatePartyIndependenceScore(0)).toBe(100);
  });
});

describe('calculateCompositeScore', () => {
  it('averages two dimension scores', () => {
    expect(calculateCompositeScore(80, 60)).toBe(70);
  });
  it('rounds to nearest integer', () => {
    expect(calculateCompositeScore(81, 80)).toBe(81);
  });
});

describe('letterGrade', () => {
  it('assigns A for 90 and above', () => {
    expect(letterGrade(90)).toBe('A');
    expect(letterGrade(100)).toBe('A');
  });
  it('assigns B for 80-89', () => {
    expect(letterGrade(80)).toBe('B');
    expect(letterGrade(89)).toBe('B');
  });
  it('assigns C for 70-79', () => {
    expect(letterGrade(75)).toBe('C');
  });
  it('assigns D for 60-69', () => {
    expect(letterGrade(65)).toBe('D');
  });
  it('assigns F below 60', () => {
    expect(letterGrade(59)).toBe('F');
    expect(letterGrade(0)).toBe('F');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server
npm test
```

Expected: FAIL — `Cannot find module './gradeService.js'`

- [ ] **Step 3: Write the grade service**

```js
// server/src/services/gradeService.js

export function calculateAttendanceScore(missedVotesPct) {
  return Math.round(Math.max(0, Math.min(100, 100 - missedVotesPct)));
}

export function calculatePartyIndependenceScore(votesWithPartyPct) {
  return Math.round(Math.max(0, Math.min(100, 100 - votesWithPartyPct)));
}

export function calculateCompositeScore(attendanceScore, partyIndependenceScore) {
  return Math.round((attendanceScore + partyIndependenceScore) / 2);
}

export function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — 11 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add server/src/services/gradeService.js server/src/services/gradeService.test.js
git commit -m "Add grade service: attendance + party independence scoring"
```

---

## Task 5: Member Service + API Routes

**Files:**
- Create: `server/src/services/memberService.js`
- Create: `server/src/routes/members.js`
- Create: `server/src/routes/members.test.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Write the failing route tests**

```js
// server/src/routes/members.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/memberService.js', () => ({
  getAllMembers: vi.fn(),
  getMemberById: vi.fn(),
}));

import { getAllMembers, getMemberById } from '../services/memberService.js';

const MOCK_MEMBER = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  chamber: 'senate',
  district: null,
  composite_score: 72,
  letter_grade: 'C',
};

describe('GET /api/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member array', async () => {
    getAllMembers.mockResolvedValue([MOCK_MEMBER]);
    const res = await request(createApp()).get('/api/members');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('A000360');
  });

  it('passes chamber query param to service', async () => {
    getAllMembers.mockResolvedValue([]);
    await request(createApp()).get('/api/members?chamber=senate');
    expect(getAllMembers).toHaveBeenCalledWith('senate');
  });

  it('returns 500 when service throws', async () => {
    getAllMembers.mockRejectedValue(new Error('DB down'));
    const res = await request(createApp()).get('/api/members');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('DB_ERROR');
  });
});

describe('GET /api/members/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns member when found', async () => {
    getMemberById.mockResolvedValue(MOCK_MEMBER);
    const res = await request(createApp()).get('/api/members/A000360');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('A000360');
  });

  it('returns 404 when member not found', async () => {
    getMemberById.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/members/NOTEXIST');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../app.js'` or route not found

- [ ] **Step 3: Write memberService.js**

```js
// server/src/services/memberService.js
import db from '../db/client.js';

export async function getAllMembers(chamber) {
  let query = `
    SELECT m.id, m.first_name, m.last_name, m.party, m.state, m.chamber,
           m.district, m.photo_url, g.composite_score, g.letter_grade, g.data_sufficient
    FROM members m
    LEFT JOIN grade_scores g ON g.member_id = m.id
    WHERE m.in_office = true
  `;
  const params = [];
  if (chamber) {
    query += ' AND m.chamber = $1';
    params.push(chamber);
  }
  query += ' ORDER BY m.state, m.last_name';
  const { rows } = await db.query(query, params);
  return rows;
}

export async function getMemberById(id) {
  const { rows } = await db.query(`
    SELECT
      m.*,
      g.attendance_score,
      g.party_independence_score,
      g.composite_score,
      g.letter_grade,
      g.data_sufficient,
      g.calculated_at AS grade_calculated_at
    FROM members m
    LEFT JOIN grade_scores g ON g.member_id = m.id
    WHERE m.id = $1
  `, [id]);
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Write the members router**

```js
// server/src/routes/members.js
import { Router } from 'express';
import { getAllMembers, getMemberById } from '../services/memberService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const members = await getAllMembers(req.query.chamber);
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members', code: 'DB_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const member = await getMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found', code: 'NOT_FOUND' });
    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch member', code: 'DB_ERROR' });
  }
});

export default router;
```

- [ ] **Step 5: Mount the router in app.js**

Replace `server/src/app.js`:

```js
// server/src/app.js
import express from 'express';
import cors from 'cors';
import membersRouter from './routes/members.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/members', membersRouter);

  return app;
}
```

- [ ] **Step 6: Run tests — verify all pass**

```bash
npm test
```

Expected: PASS — all tests pass across gradeService and members route

- [ ] **Step 7: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add server/src/
git commit -m "Add members API routes with service layer"
```

---

## Task 6: ProPublica Ingestion Worker

**Files:**
- Create: `server/src/workers/fetchMembers.js`
- Create: `server/src/workers/fetchMembers.test.js`
- Create: `server/src/workers/scheduler.js`

ProPublica endpoint used: `GET https://api.propublica.org/congress/v1/119/{senate|house}/members.json`

Each member record includes `missed_votes_pct` and `votes_with_party_pct` — exactly what Phase 1 needs.

- [ ] **Step 1: Write the failing tests for transform functions**

```js
// server/src/workers/fetchMembers.test.js
import { describe, it, expect } from 'vitest';
import { transformMember } from './fetchMembers.js';

const RAW_SENATE = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  district: null,
  in_office: true,
  url: 'https://alexander.senate.gov',
  missed_votes_pct: 3.22,
  votes_with_party_pct: 87.18,
};

describe('transformMember', () => {
  it('maps ProPublica fields to DB schema', () => {
    const result = transformMember(RAW_SENATE, 'senate');
    expect(result.id).toBe('A000360');
    expect(result.chamber).toBe('senate');
    expect(result.party).toBe('R');
    expect(result.missed_votes_pct).toBe(3.22);
    expect(result.votes_with_party_pct).toBe(87.18);
  });

  it('generates photo_url from bioguide id', () => {
    const result = transformMember(RAW_SENATE, 'senate');
    expect(result.photo_url).toBe(
      'https://theunitedstates.io/images/congress/225x275/A000360.jpg'
    );
  });

  it('defaults numeric pcts to 0 when missing', () => {
    const raw = { ...RAW_SENATE, missed_votes_pct: undefined, votes_with_party_pct: undefined };
    const result = transformMember(raw, 'senate');
    expect(result.missed_votes_pct).toBe(0);
    expect(result.votes_with_party_pct).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './fetchMembers.js'`

- [ ] **Step 3: Write the ingestion worker**

```js
// server/src/workers/fetchMembers.js
import db from '../db/client.js';
import {
  calculateAttendanceScore,
  calculatePartyIndependenceScore,
  calculateCompositeScore,
  letterGrade,
} from '../services/gradeService.js';

const BASE_URL = 'https://api.propublica.org/congress/v1';
const CURRENT_CONGRESS = 119;

export function transformMember(raw, chamber) {
  return {
    id: raw.id,
    first_name: raw.first_name,
    last_name: raw.last_name,
    party: raw.party,
    state: raw.state,
    chamber,
    district: raw.district ? parseInt(raw.district, 10) : null,
    in_office: raw.in_office ?? true,
    photo_url: `https://theunitedstates.io/images/congress/225x275/${raw.id}.jpg`,
    website: raw.url ?? null,
    missed_votes_pct: parseFloat(raw.missed_votes_pct) || 0,
    votes_with_party_pct: parseFloat(raw.votes_with_party_pct) || 0,
  };
}

async function fetchChamber(chamber) {
  const res = await fetch(
    `${BASE_URL}/${CURRENT_CONGRESS}/${chamber}/members.json`,
    { headers: { 'X-API-Key': process.env.PROPUBLICA_API_KEY } }
  );
  if (!res.ok) throw new Error(`ProPublica ${chamber} fetch failed: ${res.status}`);
  const data = await res.json();
  return data.results[0].members;
}

async function upsertMember(member) {
  await db.query(`
    INSERT INTO members
      (id, first_name, last_name, party, state, chamber, district, in_office, photo_url, website)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name,
      party      = EXCLUDED.party,
      state      = EXCLUDED.state,
      in_office  = EXCLUDED.in_office,
      photo_url  = EXCLUDED.photo_url,
      website    = EXCLUDED.website,
      updated_at = NOW()
  `, [
    member.id, member.first_name, member.last_name, member.party,
    member.state, member.chamber, member.district, member.in_office,
    member.photo_url, member.website,
  ]);
}

async function upsertGrade(member) {
  const attendanceScore = calculateAttendanceScore(member.missed_votes_pct);
  const partyIndependenceScore = calculatePartyIndependenceScore(member.votes_with_party_pct);
  const compositeScore = calculateCompositeScore(attendanceScore, partyIndependenceScore);
  const grade = letterGrade(compositeScore);

  await db.query(`
    INSERT INTO grade_scores
      (member_id, attendance_score, party_independence_score, composite_score, letter_grade, data_sufficient, calculated_at)
    VALUES ($1, $2, $3, $4, $5, true, NOW())
    ON CONFLICT (member_id) DO UPDATE SET
      attendance_score         = EXCLUDED.attendance_score,
      party_independence_score = EXCLUDED.party_independence_score,
      composite_score          = EXCLUDED.composite_score,
      letter_grade             = EXCLUDED.letter_grade,
      calculated_at            = NOW(),
      updated_at               = NOW()
  `, [member.id, attendanceScore, partyIndependenceScore, compositeScore, grade]);
}

export async function runMemberIngestion() {
  console.log('[worker] Starting member ingestion...');
  const [senateRaw, houseRaw] = await Promise.all([
    fetchChamber('senate'),
    fetchChamber('house'),
  ]);

  const all = [
    ...senateRaw.map(m => transformMember(m, 'senate')),
    ...houseRaw.map(m => transformMember(m, 'house')),
  ];

  for (const member of all) {
    await upsertMember(member);
    await upsertGrade(member);
  }

  console.log(`[worker] Ingested ${all.length} members`);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — 3 transformMember tests pass

- [ ] **Step 5: Write the cron scheduler**

```js
// server/src/workers/scheduler.js
import cron from 'node-cron';
import { runMemberIngestion } from './fetchMembers.js';

export function startScheduler() {
  // Run member ingestion daily at 6am UTC
  cron.schedule('0 6 * * *', async () => {
    try {
      await runMemberIngestion();
    } catch (err) {
      console.error('[scheduler] Member ingestion failed:', err.message);
    }
  });

  console.log('[scheduler] Cron jobs registered');
}
```

- [ ] **Step 6: Wire scheduler into server entry**

Replace `server/src/index.js`:

```js
// server/src/index.js
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { startScheduler } from './workers/scheduler.js';
import { runMemberIngestion } from './workers/fetchMembers.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, async () => {
  console.log(`Poliscope server running on http://localhost:${PORT}`);
  startScheduler();

  // Seed on startup if DB is empty
  const { default: db } = await import('./db/client.js');
  const { rows } = await db.query('SELECT COUNT(*) FROM members');
  if (parseInt(rows[0].count, 10) === 0) {
    console.log('[startup] DB empty — running initial member ingestion...');
    await runMemberIngestion();
  }
});
```

- [ ] **Step 7: Run the server and verify ingestion**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server
node src/index.js
```

Watch the logs. Expected output:
```
Poliscope server running on http://localhost:3001
[scheduler] Cron jobs registered
[startup] DB empty — running initial member ingestion...
[worker] Starting member ingestion...
[worker] Ingested 535 members
```

Verify in the DB:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM members;"
# Expected: 535

psql $DATABASE_URL -c "SELECT COUNT(*) FROM grade_scores;"
# Expected: 535

psql $DATABASE_URL -c "SELECT id, last_name, letter_grade FROM grade_scores JOIN members ON members.id = grade_scores.member_id LIMIT 5;"
# Expected: 5 rows with A/B/C/D/F grades
```

Kill the server: `Ctrl-C`

- [ ] **Step 8: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add server/src/workers/ server/src/index.js
git commit -m "Add ProPublica ingestion worker with daily cron schedule"
```

---

## Task 7: Client Foundation

**Files:**
- Modify: `client/src/index.css` ← replace with design tokens
- Modify: `client/src/main.jsx` ← add React Router
- Create: `client/src/App.jsx`

- [ ] **Step 1: Replace index.css with design tokens**

Replace the entire content of `client/src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=DM+Sans:wght@300;400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-sky: linear-gradient(160deg, #ddeeff 0%, #eef4ff 50%, #f5f8ff 100%);
  --surface: rgba(255, 255, 255, 0.75);
  --border: rgba(255, 255, 255, 0.9);
  --navy: #0a1f6e;
  --sky-accent: #1a4aaa;
  --alert: #cc2222;
  --positive: #1a7a4a;
  --shadow: rgba(20, 60, 180, 0.12);
}

body {
  background: var(--bg-sky);
  min-height: 100dvh;
  font-family: 'DM Sans', sans-serif;
  font-weight: 300;
  color: var(--navy);
}

h1, h2, h3, h4, .display {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 700;
}

.glass-card {
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: 0 20px 60px var(--shadow);
  border-radius: 16px;
}
```

- [ ] **Step 2: Delete Vite's generated boilerplate**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/client
rm -rf src/assets src/App.css
```

- [ ] **Step 3: Write App.jsx with routing**

```jsx
// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Rep from './pages/Rep';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rep/:id" element={<Rep />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Update main.jsx**

Replace `client/src/main.jsx`:

```jsx
// client/src/main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Write the useMembers hook**

```js
// client/src/hooks/useMembers.js
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL_MS = 60_000;

export function useMembers(chamber) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMembers() {
      try {
        const url = chamber
          ? `${API_BASE}/api/members?chamber=${chamber}`
          : `${API_BASE}/api/members`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setMembers(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchMembers();
    const timer = setInterval(fetchMembers, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [chamber]);

  return { members, loading, error };
}
```

- [ ] **Step 6: Configure Vite proxy (avoids CORS in dev)**

Replace `client/vite.config.js`:

```js
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

With this proxy, the hook should use `/api` in dev (no CORS):

Update `client/src/hooks/useMembers.js` — change `API_BASE`:

```js
const API_BASE = '';  // proxy handles it in dev; set VITE_API_URL in production
```

- [ ] **Step 7: Configure Vitest for client**

Add `client/vitest.config.js`:

```js
// client/vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
});
```

Add `client/src/test-setup.js`:

```js
import '@testing-library/jest-dom';
```

Install testing deps:

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/client
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

Update `client/package.json` to add test script:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src"
  }
}
```

- [ ] **Step 8: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add client/
git commit -m "Set up React client with design tokens, routing, and useMembers hook"
```

---

## Task 8: SeatDot + ChamberGrid Components

**Files:**
- Create: `client/src/components/SeatDot/SeatDot.jsx`
- Create: `client/src/components/SeatDot/SeatDot.test.jsx`
- Create: `client/src/components/ChamberGrid/ChamberGrid.jsx`
- Create: `client/src/components/ChamberGrid/ChamberGrid.test.jsx`

- [ ] **Step 1: Write failing SeatDot tests**

```jsx
// client/src/components/SeatDot/SeatDot.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SeatDot } from './SeatDot';

const member = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  letter_grade: 'C',
};

describe('SeatDot', () => {
  it('renders a button with accessible label', () => {
    render(<SeatDot member={member} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Lamar Alexander, R, TN');
  });

  it('calls onClick with member id when clicked', () => {
    const handleClick = vi.fn();
    render(<SeatDot member={member} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith('A000360');
  });

  it('applies red background for Republican', () => {
    render(<SeatDot member={member} onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('rgb(204, 34, 34)');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/client
npm test
```

Expected: FAIL — `Cannot find module './SeatDot'`

- [ ] **Step 3: Write SeatDot.jsx**

```jsx
// client/src/components/SeatDot/SeatDot.jsx

const PARTY_COLOR = {
  D: '#1a4aaa',
  R: '#cc2222',
  I: '#8b6914',
};

const GRADE_GLOW = {
  A: '0 0 8px 2px rgba(26, 122, 74, 0.8)',
  B: '0 0 6px 2px rgba(42, 154, 90, 0.6)',
  C: '0 0 4px 2px rgba(204, 170, 34, 0.5)',
  D: '0 0 4px 2px rgba(204, 102, 34, 0.5)',
  F: '0 0 6px 2px rgba(204, 34, 34, 0.6)',
};

export function SeatDot({ member, onClick }) {
  const bgColor = PARTY_COLOR[member.party] ?? '#666';
  const glow = member.letter_grade ? GRADE_GLOW[member.letter_grade] : 'none';

  return (
    <button
      aria-label={`${member.first_name} ${member.last_name}, ${member.party}, ${member.state}`}
      onClick={() => onClick(member.id)}
      style={{ backgroundColor: bgColor, boxShadow: glow }}
      className="w-3 h-3 rounded-full transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400"
    />
  );
}
```

- [ ] **Step 4: Run SeatDot tests — verify they pass**

```bash
npm test
```

Expected: PASS — 3 SeatDot tests pass

- [ ] **Step 5: Write failing ChamberGrid tests**

```jsx
// client/src/components/ChamberGrid/ChamberGrid.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChamberGrid } from './ChamberGrid';

const members = [
  { id: 'A000001', first_name: 'Alice', last_name: 'Smith', party: 'D', state: 'CA', letter_grade: 'A' },
  { id: 'B000001', first_name: 'Bob', last_name: 'Jones', party: 'R', state: 'TX', letter_grade: 'C' },
];

function renderGrid(props) {
  return render(
    <MemoryRouter>
      <ChamberGrid {...props} />
    </MemoryRouter>
  );
}

describe('ChamberGrid', () => {
  it('renders a seat button for each member', () => {
    renderGrid({ members, onSelectMember: vi.fn() });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows loading state when members array is empty and loading is true', () => {
    renderGrid({ members: [], loading: true, onSelectMember: vi.fn() });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows member count in the heading', () => {
    renderGrid({ members, onSelectMember: vi.fn() });
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ChamberGrid'`

- [ ] **Step 7: Write ChamberGrid.jsx**

```jsx
// client/src/components/ChamberGrid/ChamberGrid.jsx
import { SeatDot } from '../SeatDot/SeatDot';

export function ChamberGrid({ members = [], loading = false, onSelectMember }) {
  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sky-accent opacity-60">Loading congressional data...</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-display mb-4 opacity-60">{members.length} members</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {members.map(member => (
          <SeatDot
            key={member.id}
            member={member}
            onClick={onSelectMember}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run all client tests — verify they pass**

```bash
npm test
```

Expected: PASS — all 6 tests pass (3 SeatDot + 3 ChamberGrid)

- [ ] **Step 9: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add client/src/components/
git commit -m "Add SeatDot and ChamberGrid components with tests"
```

---

## Task 9: PlayerPage Component

**Files:**
- Create: `client/src/components/PlayerPage/PlayerPage.jsx`
- Create: `client/src/components/PlayerPage/PlayerPage.test.jsx`

- [ ] **Step 1: Write failing PlayerPage tests**

```jsx
// client/src/components/PlayerPage/PlayerPage.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PlayerPage } from './PlayerPage';

const member = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  chamber: 'senate',
  photo_url: 'https://theunitedstates.io/images/congress/225x275/A000360.jpg',
  website: 'https://alexander.senate.gov',
  letter_grade: 'B',
  composite_score: 82,
  attendance_score: 91,
  party_independence_score: 73,
  data_sufficient: true,
  grade_calculated_at: '2026-04-25T00:00:00Z',
};

function renderPage(props) {
  return render(
    <MemoryRouter>
      <PlayerPage {...props} />
    </MemoryRouter>
  );
}

describe('PlayerPage', () => {
  it('renders member full name', () => {
    renderPage({ member });
    expect(screen.getByText('Lamar Alexander')).toBeInTheDocument();
  });

  it('renders the letter grade prominently', () => {
    renderPage({ member });
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders the composite score', () => {
    renderPage({ member });
    expect(screen.getByText('82')).toBeInTheDocument();
  });

  it('renders both dimension scores', () => {
    renderPage({ member });
    expect(screen.getByText('Attendance')).toBeInTheDocument();
    expect(screen.getByText('Party Independence')).toBeInTheDocument();
  });

  it('renders loading state when no member provided', () => {
    renderPage({ member: null });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('links to the member website', () => {
    renderPage({ member });
    const link = screen.getByRole('link', { name: /official website/i });
    expect(link).toHaveAttribute('href', 'https://alexander.senate.gov');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './PlayerPage'`

- [ ] **Step 3: Write PlayerPage.jsx**

```jsx
// client/src/components/PlayerPage/PlayerPage.jsx

const GRADE_COLOR = {
  A: '#1a7a4a',
  B: '#2a9a5a',
  C: '#cc9900',
  D: '#cc6600',
  F: '#cc2222',
};

function DimensionBar({ label, score }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-display font-bold">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            backgroundColor: score >= 70 ? '#1a7a4a' : score >= 50 ? '#cc9900' : '#cc2222',
          }}
        />
      </div>
    </div>
  );
}

export function PlayerPage({ member }) {
  if (!member) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="opacity-60">Loading member profile...</p>
      </div>
    );
  }

  const gradeColor = GRADE_COLOR[member.letter_grade] ?? '#666';
  const chamberLabel = member.chamber === 'senate' ? 'Senator' : 'Representative';

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Identity header */}
      <div className="glass-card p-6 mb-4 flex gap-4 items-start">
        {member.photo_url && (
          <img
            src={member.photo_url}
            alt={`${member.first_name} ${member.last_name}`}
            className="w-20 h-24 object-cover rounded-xl flex-shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div>
          <h1 className="text-2xl font-display font-bold">
            {member.first_name} {member.last_name}
          </h1>
          <p className="opacity-70 mt-1">
            {chamberLabel} · {member.state} · {member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent'}
          </p>
          {member.website && (
            <a
              href={member.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Official website"
              className="text-sm mt-2 inline-block"
              style={{ color: 'var(--sky-accent)' }}
            >
              Official website ↗
            </a>
          )}
        </div>
      </div>

      {/* Constituent Grade */}
      <div className="glass-card p-6 mb-4">
        <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Constituent Grade</h2>

        {!member.data_sufficient ? (
          <p className="text-sm opacity-60">Grade pending — insufficient data (90-day minimum)</p>
        ) : (
          <>
            <div className="flex items-center gap-6 mb-6">
              <div
                className="text-6xl font-display font-bold w-20 h-20 rounded-2xl flex items-center justify-center text-white"
                style={{ backgroundColor: gradeColor }}
              >
                {member.letter_grade}
              </div>
              <div>
                <div className="text-5xl font-display font-bold" style={{ color: 'var(--navy)' }}>
                  {member.composite_score}
                </div>
                <div className="text-xs opacity-50 mt-1">out of 100</div>
              </div>
            </div>

            <div className="text-xs uppercase tracking-widest opacity-50 mb-3">Score Breakdown</div>
            {member.attendance_score != null && (
              <DimensionBar label="Attendance" score={member.attendance_score} />
            )}
            {member.party_independence_score != null && (
              <DimensionBar label="Party Independence" score={member.party_independence_score} />
            )}

            <p className="text-xs opacity-40 mt-4">
              Phase 1 score: 2 of 5 dimensions. Full grade (including Financial Self-Dealing,
              Constituent Alignment, and Legislative Impact) arrives in Phase 3.
              {member.grade_calculated_at && (
                <> Last calculated {new Date(member.grade_calculated_at).toLocaleDateString()}.</>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — all 6 PlayerPage tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add client/src/components/PlayerPage/
git commit -m "Add PlayerPage component with grade display and dimension bars"
```

---

## Task 10: Wire Up Pages and Run the Full App

**Files:**
- Create: `client/src/pages/Home.jsx`
- Create: `client/src/pages/Rep.jsx`

- [ ] **Step 1: Write Home.jsx**

```jsx
// client/src/pages/Home.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChamberGrid } from '../components/ChamberGrid/ChamberGrid';
import { useMembers } from '../hooks/useMembers';

export default function Home() {
  const [chamber, setChamber] = useState('senate');
  const navigate = useNavigate();
  const { members, loading, error } = useMembers(chamber);

  return (
    <div className="min-h-dvh px-4 py-6">
      {/* Masthead */}
      <header
        className="rounded-2xl p-5 mb-6 text-white"
        style={{ background: 'linear-gradient(135deg, #cc0000, #0a1f6e)' }}
      >
        <h1 className="text-3xl font-display font-bold tracking-tight">POLISCOPE</h1>
        <p className="text-sm opacity-75 mt-1">
          Radical transparency for American democracy.
        </p>
      </header>

      {/* Chamber toggle */}
      <div className="flex gap-2 mb-6">
        {['senate', 'house'].map(c => (
          <button
            key={c}
            onClick={() => setChamber(c)}
            className="px-5 py-2 rounded-full text-sm font-display font-bold transition-all"
            style={{
              backgroundColor: chamber === c ? 'var(--navy)' : 'var(--surface)',
              color: chamber === c ? 'white' : 'var(--navy)',
              border: '1px solid var(--border)',
            }}
          >
            {c === 'senate' ? 'Senate' : 'House'}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--alert)' }}>
          Could not load members: {error}
        </p>
      )}

      <ChamberGrid
        members={members}
        loading={loading}
        onSelectMember={(id) => navigate(`/rep/${id}`)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write Rep.jsx**

```jsx
// client/src/pages/Rep.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerPage } from '../components/PlayerPage/PlayerPage';

export default function Rep() {
  const { id } = useParams();
  const navigate = useNavigate();
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
    <div className="min-h-dvh">
      <div className="px-4 pt-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-display mb-2 flex items-center gap-1"
          style={{ color: 'var(--sky-accent)' }}
        >
          ← Back to Chamber
        </button>
      </div>

      {error ? (
        <div className="px-4">
          <p style={{ color: 'var(--alert)' }}>Member not found.</p>
        </div>
      ) : (
        <PlayerPage member={member} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Start the server**

In one terminal:

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server
node src/index.js
```

Expected: `Poliscope server running on http://localhost:3001`

If the DB already has data from Task 6, you should NOT see the ingestion log again.

- [ ] **Step 4: Start the client dev server**

In a second terminal:

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/client
npm run dev
```

Expected: `Local: http://localhost:5173/`

- [ ] **Step 5: Verify the chamber view**

Open `http://localhost:5173` in a browser.

Verify:
- The red-to-navy Poliscope masthead appears at the top
- "Senate" and "House" toggle buttons are present
- Senate is selected by default — 100 colored seat dots appear
- Dot colors: blue (Democrat), red (Republican), gold (Independent)
- Dots have a subtle glow matching their grade

- [ ] **Step 6: Verify seat navigation**

Click any seat dot.

Verify:
- URL changes to `/rep/[member-id]`
- Member photo, name, state, party appears
- Grade card shows letter + number score
- Attendance and Party Independence bars appear
- "← Back to Chamber" button works

- [ ] **Step 7: Verify House toggle**

Back on the home screen, click "House".

Verify:
- Grid updates to show ~435 House seat dots
- Seat colors remain correct

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope/server && npm test
cd ../client && npm test
```

Expected: all tests pass in both workspaces.

- [ ] **Step 9: Final commit**

```bash
cd /Users/cammargeson/Claude/imagine/poliscope
git add client/src/pages/
git commit -m "Wire up Home and Rep pages — Phase 1 complete"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in Phase 1? |
|---|---|
| All 535 members ingested | ✓ Task 6 — ProPublica ingestion |
| Voting record | Deferred (Phase 2 — Congress.gov vote records) |
| Attendance record | ✓ Task 4/6 — `missed_votes_pct` |
| Financial disclosures / stock trades | Deferred (Phase 3) |
| Campaign finance / FEC data | Deferred (Phase 3) |
| Constituent Grade | ✓ Tasks 4–5 — 2 of 5 dimensions |
| Pattern Engine | Deferred (Phase 4) |
| 3D chamber (React Three Fiber) | Deferred (Phase 2) — Phase 1 uses 2D dot grid |
| Bill Page | Deferred (Phase 5) |
| Mobile responsive | ✓ Tailwind mobile-first classes throughout |
| Design tokens (CNN Light palette) | ✓ Task 7 |
| Bricolage Grotesque + DM Sans | ✓ Task 7 |
| React Router URLs `/rep/[state]-[name]` | Partial — Phase 1 uses bioguide ID; slug URL requires Phase 2 |
| Auth / user accounts | Deferred (Phase 6) |
| Push notifications | Deferred (Phase 6) |
| PostgreSQL source of truth | ✓ — no live API calls in request path |
| Scheduled ingestion | ✓ Task 6 — daily cron |

**Type consistency:** `transformMember` returns `missed_votes_pct` and `votes_with_party_pct` — both used in `upsertGrade`. `gradeService` functions are pure with consistent signatures throughout. `PlayerPage` expects `attendance_score`, `party_independence_score`, `composite_score`, `letter_grade` — all present in `getMemberById` query.

**Placeholder scan:** No TBDs. All code blocks complete. All commands include expected output.

---

## What Phase 1 Delivers

A running Poliscope with:
- Real data on all 535 current members of Congress
- Attendance + Party Independence scores (2 of 5 grade dimensions)
- A REST API serving member data from PostgreSQL
- A mobile-first frontend: seat grid home screen + Player Page
- Daily refresh from ProPublica

**Phase 2 adds:** 3D React Three Fiber chamber, Congress.gov vote records, full voting history per member, and slug-style URLs.
