import { getPool } from './_db.js';

const CONGRESS = 119;
const SESSION = 1;
const BASE = 'https://api.congress.gov/v3';

const WEIGHTS = { attendance: 0.30, partyIndep: 0.25, legislative: 0.20, finance: 0.15, bipartisan: 0.10 };

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

async function cgFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${process.env.CONGRESS_API_KEY}`);
  if (!res.ok) throw new Error(`Congress.gov ${path}: ${res.status}`);
  return res.json();
}

async function computeLegislativeScores(memberId) {
  try {
    const data = await cgFetch(`/member/${memberId}/sponsored-legislation?limit=250`);
    // Filter to actual bills only (amendments have amendmentNumber field and null type)
    const bills = (data?.sponsoredLegislation ?? []).filter(b => b.type && !b.amendmentNumber);
    const introduced = bills.length;
    if (introduced === 0) return { legislativeScore: 0, bipartisanScore: 0 };

    // "Advanced" = any action beyond introduction (committee referral still counts)
    // Use passage/signing for the strongest score, committee progression for partial credit
    const fullyPassed = bills.filter(b => {
      const a = (b.latestAction?.text ?? '').toLowerCase();
      return a.includes('passed') || a.includes('signed') || a.includes('became public law');
    }).length;
    const hadAction = bills.filter(b => {
      const a = (b.latestAction?.text ?? '');
      return a.length > 0 && b.latestAction?.actionDate;
    }).length;

    // Score = (full passage × 1.0 + any action × 0.3) / introduced, scaled to 100
    const legislativeScore = Math.min(((fullyPassed * 1.0 + hadAction * 0.3) / introduced) * 100, 100);
    // Bipartisan approximated by bills with any action (proxy until cosponsor API added)
    const bipartisanScore = Math.min((hadAction / introduced) * 100, 100);
    return { legislativeScore, bipartisanScore };
  } catch {
    return { legislativeScore: 0, bipartisanScore: 0 };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['authorization'];
  if (process.env.INGEST_SECRET && secret !== `Bearer ${process.env.INGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  let updated = 0;

  try {
    const { rows: members } = await pool.query(`SELECT id FROM members WHERE in_office = true`);

    for (const { id: memberId } of members) {
      // Attendance + party independence from vote_records
      const { rows: voteRows } = await pool.query(
        `SELECT vote_cast, party_vote FROM vote_records WHERE member_id = $1 AND congress = $2 AND session_num = $3`,
        [memberId, CONGRESS, SESSION]
      );

      const eligible = voteRows.length;
      const cast = voteRows.filter(r => ['Yea', 'Nay', 'Present'].includes(r.vote_cast)).length;
      const partisanRows = voteRows.filter(r => ['Yea', 'Nay'].includes(r.vote_cast) && r.party_vote);
      const crossover = partisanRows.filter(r => r.vote_cast !== r.party_vote).length;

      const attendanceScore = eligible > 0 ? (cast / eligible) * 100 : 0;
      const partyIndepScore = partisanRows.length > 0
        ? Math.min((crossover / partisanRows.length) * 500, 100)
        : 0;

      const { legislativeScore, bipartisanScore } = await computeLegislativeScores(memberId);

      // Pull existing finance score if FEC already ran
      const { rows: existing } = await pool.query(
        `SELECT campaign_finance_score FROM grade_scores WHERE member_id = $1`,
        [memberId]
      );
      const financeScore = existing[0]?.campaign_finance_score ?? 50;

      const dataSufficient = eligible >= 10;
      const composite =
        attendanceScore * WEIGHTS.attendance +
        partyIndepScore * WEIGHTS.partyIndep +
        legislativeScore * WEIGHTS.legislative +
        financeScore * WEIGHTS.finance +
        bipartisanScore * WEIGHTS.bipartisan;

      // Score window
      const { rows: winRows } = await pool.query(
        `SELECT MIN(vote_date) AS start, MAX(vote_date) AS end FROM vote_records WHERE member_id = $1 AND congress = $2 AND session_num = $3`,
        [memberId, CONGRESS, SESSION]
      );
      const windowStart = winRows[0]?.start ?? null;
      const windowEnd = winRows[0]?.end ?? null;

      await pool.query(
        `INSERT INTO grade_scores (member_id, attendance_score, party_independence_score, legislative_score,
           bipartisan_score, composite_score, letter_grade, data_sufficient, total_votes_eligible, votes_cast,
           score_window_start, score_window_end, calculated_at, updated_at)
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
         composite, letterGrade(composite), dataSufficient, eligible, cast, windowStart, windowEnd]
      );
      updated++;
    }

    res.json({ ok: true, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
