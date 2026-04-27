import { getPool } from './_db.js';

const CONGRESS = 119;
const SESSION = 1;
const BASE = 'https://api.congress.gov/v3';

const SKIP_QUESTIONS = ['quorum', 'adjourn', 'recess', 'prayer', 'pledge'];

function shouldSkip(q) {
  return SKIP_QUESTIONS.some(w => (q ?? '').toLowerCase().includes(w));
}

function categorizePurpose(q) {
  const t = (q ?? '').toLowerCase();
  if (t.includes('passage') || t.includes('pass')) return 'passage';
  if (t.includes('amendment')) return 'amendment';
  if (t.includes('previous question') || t.includes('motion to') || t.includes('rule')) return 'procedural';
  if (t.includes('nomination') || t.includes('confirm')) return 'nomination';
  return 'other';
}

async function cgFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${process.env.CONGRESS_API_KEY}`);
  if (!res.ok) throw new Error(`Congress.gov ${path}: ${res.status}`);
  return res.json();
}

async function fetchVoteList() {
  const votes = [];
  let offset = 0;
  while (true) {
    const data = await cgFetch(`/house-vote/${CONGRESS}/${SESSION}?limit=250&offset=${offset}`);
    const batch = data?.houseRollCallVotes ?? [];
    votes.push(...batch);
    if (batch.length < 250) break;
    offset += 250;
  }
  return votes;
}

function normalizeVoteCast(raw) {
  if (['Yea', 'Yes', 'Aye'].includes(raw)) return 'Yea';
  if (['Nay', 'No'].includes(raw)) return 'Nay';
  return raw || 'Not Voting';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['authorization'];
  if (process.env.INGEST_SECRET && secret !== `Bearer ${process.env.INGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  const batchLimit = parseInt(req.query?.limit ?? '50', 10);
  let inserted = 0, skipped = 0, errors = 0;

  try {
    // Pre-load valid member IDs to avoid FK violations on delegates/non-members
    const { rows: memberRows } = await pool.query(`SELECT id FROM members WHERE chamber = 'house'`);
    const validMembers = new Set(memberRows.map(r => r.id));

    const { rows } = await pool.query(
      `SELECT vote_number FROM vote_records WHERE chamber = 'house' AND congress = $1 AND session_num = $2`,
      [CONGRESS, SESSION]
    );
    const alreadyIngested = new Set(rows.map(r => r.vote_number));

    const voteList = await fetchVoteList();
    console.log(`House: ${voteList.length} votes, ${alreadyIngested.size} already ingested`);
    let processed = 0;

    for (const entry of voteList) {
      if (processed >= batchLimit) break;
      const voteNumber = parseInt(entry.rollCallNumber, 10);
      if (!voteNumber || alreadyIngested.has(voteNumber)) continue;
      if (shouldSkip(entry.voteType ?? '')) { skipped++; continue; }

      try {
        const detail = await cgFetch(`/house-vote/${CONGRESS}/${SESSION}/${voteNumber}/members`);
        const memberVotes = (detail?.houseRollCallVoteMemberVotes?.results ?? [])
          .filter(mv => validMembers.has(mv.bioguideID));
        const voteDate = entry.startDate ? new Date(entry.startDate).toISOString().slice(0, 10) : null;
        const category = categorizePurpose(entry.voteType);

        const partyTotals = {};
        for (const mv of memberVotes) {
          const p = mv.voteParty;
          const vc = normalizeVoteCast(mv.voteCast);
          if (!partyTotals[p]) partyTotals[p] = { yea: 0, nay: 0 };
          if (vc === 'Yea') partyTotals[p].yea++;
          else if (vc === 'Nay') partyTotals[p].nay++;
        }

        for (const mv of memberVotes) {
          const bioguideId = mv.bioguideID;
          if (!bioguideId) continue;
          const voteCast = normalizeVoteCast(mv.voteCast);
          const pt = partyTotals[mv.voteParty];
          const partyMajority = pt ? (pt.yea >= pt.nay ? 'Yea' : 'Nay') : null;

          await pool.query(
            `INSERT INTO vote_records (member_id, vote_date, chamber, congress, session_num, vote_number, vote_cast, party_vote, vote_category)
             VALUES ($1,$2,'house',$3,$4,$5,$6,$7,$8)
             ON CONFLICT (member_id, congress, session_num, vote_number) DO NOTHING`,
            [bioguideId, voteDate, CONGRESS, SESSION, voteNumber, voteCast, partyMajority, category]
          );
          inserted++;
        }
        processed++;
      } catch (err) {
        console.error(`House vote ${voteNumber} error:`, err.message);
        errors++;
      }
    }

    res.json({ ok: true, inserted, skipped, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
