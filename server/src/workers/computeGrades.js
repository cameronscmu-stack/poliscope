import pool from '../db/client.js';

const CONGRESS = 119;
const SESSION = 1;
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

const WEIGHTS = {
  attendance: 0.30,
  partyIndep: 0.25,
  legislative: 0.20,
  finance: 0.15,
  bipartisan: 0.10,
};

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

async function cgFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`Congress.gov ${path}: ${res.status}`);
  return res.json();
}

async function computeVoteScores(client, memberId) {
  const { rows } = await client.query(
    `SELECT vote_cast, party_vote
     FROM vote_records
     WHERE member_id = $1 AND congress = $2 AND session_num = $3`,
    [memberId, CONGRESS, SESSION]
  );

  const eligible = rows.length;
  const cast = rows.filter(r => ['Yea', 'Nay', 'Present'].includes(r.vote_cast)).length;
  const partisanRows = rows.filter(r => ['Yea', 'Nay'].includes(r.vote_cast) && r.party_vote != null);
  const crossover = partisanRows.filter(r => r.vote_cast !== r.party_vote).length;

  const attendanceScore = eligible > 0 ? (cast / eligible) * 100 : 0;
  // Scale crossover: multiply by 500 so ~20% crossover = 100 pts (typical range 2–15%)
  const partyIndepScore = partisanRows.length > 0
    ? Math.min((crossover / partisanRows.length) * 500, 100)
    : 0;

  return { attendanceScore, partyIndepScore, eligible, cast };
}

async function computeLegislativeScores(memberId) {
  try {
    const data = await cgFetch(`/member/${memberId}/sponsored-legislation?limit=250`);
    const bills = (data?.sponsoredLegislation ?? []).filter(
      b => !['HAMDT', 'SAMDT'].includes(b.type)
    );

    const introduced = bills.length;
    if (introduced === 0) return { legislativeScore: 0, bipartisanScore: 0, introduced };

    const advanced = bills.filter(b => {
      const action = (b.latestAction?.text ?? '').toLowerCase();
      return action.includes('passed') || action.includes('signed') || action.includes('became public law');
    }).length;

    const withCosponsors = bills.filter(b => (b.cosponsors?.count ?? b.cosponsorsCount ?? 0) > 0).length;

    const advancementRate = advanced / introduced;
    const cosponsorRate = withCosponsors / introduced;
    const legislativeScore = (advancementRate * 0.6 + cosponsorRate * 0.4) * 100;

    // For bipartisan: bills with cross-party cosponsors (approximated by cosponsors > 0
    // for now; Phase 5 will refine with actual party breakdown)
    const bipartisanBills = withCosponsors; // refined in Phase 5
    const bipartisanScore = Math.min((bipartisanBills / introduced) * 200, 100);

    return { legislativeScore, bipartisanScore, introduced };
  } catch {
    return { legislativeScore: 0, bipartisanScore: 0, introduced: 0 };
  }
}

async function getWindowDates(client, memberId) {
  const { rows } = await client.query(
    `SELECT MIN(vote_date) AS start, MAX(vote_date) AS end
     FROM vote_records WHERE member_id = $1 AND congress = $2 AND session_num = $3`,
    [memberId, CONGRESS, SESSION]
  );
  return { start: rows[0]?.start ?? null, end: rows[0]?.end ?? null };
}

export async function computeGrades({ verbose = false } = {}) {
  const client = await pool.connect();
  let updated = 0;
  let skipped = 0;

  try {
    const { rows: members } = await client.query(
      `SELECT id FROM members WHERE in_office = true`
    );

    for (const { id: memberId } of members) {
      const { attendanceScore, partyIndepScore, eligible, cast } =
        await computeVoteScores(client, memberId);

      const { legislativeScore, bipartisanScore, introduced } =
        await computeLegislativeScores(memberId);

      // Get campaign finance score from grade_scores if FEC already ran
      const { rows: existing } = await client.query(
        `SELECT campaign_finance_score FROM grade_scores WHERE member_id = $1`,
        [memberId]
      );
      const financeScore = existing[0]?.campaign_finance_score ?? null;

      const dataSufficient = eligible >= 10 && introduced >= 3;
      if (!dataSufficient) { skipped++; }

      // Composite — uses financeScore if available, otherwise leaves out its weight
      const effectiveFinance = financeScore ?? 50; // neutral placeholder
      const composite =
        attendanceScore * WEIGHTS.attendance +
        partyIndepScore * WEIGHTS.partyIndep +
        legislativeScore * WEIGHTS.legislative +
        effectiveFinance * WEIGHTS.finance +
        bipartisanScore * WEIGHTS.bipartisan;

      const { start, end } = await getWindowDates(client, memberId);

      await client.query(
        `INSERT INTO grade_scores (member_id, attendance_score, party_independence_score,
           legislative_score, bipartisan_score, composite_score, letter_grade, data_sufficient,
           total_votes_eligible, votes_cast, score_window_start, score_window_end, calculated_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
         ON CONFLICT (member_id) DO UPDATE SET
           attendance_score = EXCLUDED.attendance_score,
           party_independence_score = EXCLUDED.party_independence_score,
           legislative_score = EXCLUDED.legislative_score,
           bipartisan_score = EXCLUDED.bipartisan_score,
           composite_score = EXCLUDED.composite_score,
           letter_grade = EXCLUDED.letter_grade,
           data_sufficient = EXCLUDED.data_sufficient,
           total_votes_eligible = EXCLUDED.total_votes_eligible,
           votes_cast = EXCLUDED.votes_cast,
           score_window_start = EXCLUDED.score_window_start,
           score_window_end = EXCLUDED.score_window_end,
           updated_at = now()`,
        [memberId, attendanceScore, partyIndepScore, legislativeScore, bipartisanScore,
         composite, letterGrade(composite), dataSufficient, eligible, cast, start, end]
      );
      updated++;

      if (verbose) console.log(`  ${memberId}: A=${attendanceScore.toFixed(1)} PI=${partyIndepScore.toFixed(1)} L=${legislativeScore.toFixed(1)} B=${bipartisanScore.toFixed(1)} → ${letterGrade(composite)} (${composite.toFixed(1)})`);
    }

    return { updated, skipped };
  } finally {
    client.release();
  }
}

if (process.argv[1].endsWith('computeGrades.js')) {
  computeGrades({ verbose: true })
    .then(r => { console.log('Done:', r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
