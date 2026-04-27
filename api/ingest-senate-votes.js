import { XMLParser } from 'fast-xml-parser';
import { getPool } from './_db.js';

const CONGRESS = 119;
const SESSION = 1;
const VOTE_LIST_URL = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${SESSION}.xml`;

const SKIP_QUESTIONS = ['quorum', 'adjourn', 'adjournment', 'recess', 'executive session'];

function getQuestionText(entry) {
  // en_bloc votes nest question inside en_bloc.matter; fall back to title
  if (typeof entry.question === 'string') return entry.question;
  return typeof entry.title === 'string' ? entry.title : '';
}

function shouldSkip(q) {
  return SKIP_QUESTIONS.some(w => (q ?? '').toLowerCase().includes(w));
}

function categorizePurpose(q) {
  const t = (q ?? '').toLowerCase();
  if (t.includes('passage') || t.includes('pass')) return 'passage';
  if (t.includes('amendment') || t.includes('amdt')) return 'amendment';
  if (t.includes('cloture') || t.includes('motion to proceed') || t.includes('proceed')) return 'procedural';
  if (t.includes('nomination') || t.includes('confirm')) return 'nomination';
  if (t.includes('treaty')) return 'treaty';
  return 'other';
}

async function fetchVoteList() {
  const res = await fetch(VOTE_LIST_URL);
  if (!res.ok) throw new Error(`Vote list fetch failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(xml);
  const votes = doc?.vote_summary?.votes?.vote ?? [];
  return Array.isArray(votes) ? votes : [votes];
}

async function fetchVoteDetail(voteNumber) {
  const padded = String(voteNumber).padStart(5, '0');
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${SESSION}/vote_${CONGRESS}_${SESSION}_${padded}.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vote detail ${voteNumber} failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  return parser.parse(xml);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['authorization'];
  if (process.env.INGEST_SECRET && secret !== `Bearer ${process.env.INGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  // Process at most `limit` new votes per call to avoid Vercel timeout (default 50)
  const batchLimit = parseInt(req.query?.limit ?? '50', 10);
  let inserted = 0, skipped = 0, errors = 0;

  try {
    const { rows } = await pool.query(
      `SELECT vote_number FROM vote_records WHERE chamber = 'senate' AND congress = $1 AND session_num = $2`,
      [CONGRESS, SESSION]
    );
    const alreadyIngested = new Set(rows.map(r => r.vote_number));

    const voteList = await fetchVoteList();
    console.log(`Senate: ${voteList.length} votes, ${alreadyIngested.size} already ingested`);
    let processed = 0;

    for (const entry of voteList) {
      if (processed >= batchLimit) break;
      const voteNumber = parseInt(entry.vote_number, 10);
      if (!voteNumber || alreadyIngested.has(voteNumber)) continue;
      const questionText = getQuestionText(entry);
      if (shouldSkip(questionText)) { skipped++; continue; }

      try {
        const detail = await fetchVoteDetail(voteNumber);
        const vd = detail?.roll_call_vote;
        if (!vd) continue;

        const voteDate = vd.vote_date ? new Date(vd.vote_date).toISOString().slice(0, 10) : null;
        const category = categorizePurpose(typeof vd.question === 'string' ? vd.question : questionText);
        const memberList = Array.isArray(vd?.members?.member) ? vd.members.member : [vd?.members?.member].filter(Boolean);

        const partyTotals = {};
        for (const m of memberList) {
          const p = m.party ?? 'I';
          if (!partyTotals[p]) partyTotals[p] = { yea: 0, nay: 0 };
          if (m.vote_cast === 'Yea') partyTotals[p].yea++;
          else if (m.vote_cast === 'Nay') partyTotals[p].nay++;
        }

        for (const m of memberList) {
          if (!m.last_name || !m.state || !m.vote_cast) continue;
          const { rows: found } = await pool.query(
            `SELECT id FROM members WHERE UPPER(last_name) = UPPER($1) AND state = UPPER($2) AND party = UPPER($3) AND chamber = 'senate' AND in_office = true LIMIT 1`,
            [m.last_name, m.state, m.party ?? 'I']
          );
          if (!found[0]) continue;

          const pt = partyTotals[m.party];
          const partyMajority = pt ? (pt.yea >= pt.nay ? 'Yea' : 'Nay') : null;

          await pool.query(
            `INSERT INTO vote_records (member_id, vote_date, chamber, congress, session_num, vote_number, vote_cast, party_vote, vote_category)
             VALUES ($1,$2,'senate',$3,$4,$5,$6,$7,$8)
             ON CONFLICT (member_id, congress, session_num, vote_number) DO NOTHING`,
            [found[0].id, voteDate, CONGRESS, SESSION, voteNumber, m.vote_cast, partyMajority, category]
          );
          inserted++;
        }
        processed++;
      } catch (err) {
        console.error(`Senate vote ${voteNumber} error:`, err.message);
        errors++;
      }
    }

    const remaining = voteList.filter(v => {
      const n = parseInt(v.vote_number, 10);
      return n && !alreadyIngested.has(n) && !shouldSkip(getQuestionText(v));
    }).length - processed;

    res.json({ ok: true, inserted, skipped, errors, remaining: Math.max(0, remaining) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
