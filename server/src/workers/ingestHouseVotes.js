import pool from '../db/client.js';

const CONGRESS = 119;
const SESSION = 1;
const API_KEY = process.env.CONGRESS_API_KEY;
const BASE = 'https://api.congress.gov/v3';

// Votes to skip
const SKIP_QUESTIONS = ['quorum', 'adjourn', 'recess', 'prayer', 'pledge'];

function shouldSkip(questionText) {
  if (!questionText) return false;
  const q = questionText.toLowerCase();
  return SKIP_QUESTIONS.some(word => q.includes(word));
}

function categorizePurpose(questionText) {
  if (!questionText) return 'other';
  const q = questionText.toLowerCase();
  if (q.includes('passage') || q.includes('pass')) return 'passage';
  if (q.includes('amendment')) return 'amendment';
  if (q.includes('previous question') || q.includes('motion to') || q.includes('rule')) return 'procedural';
  if (q.includes('nomination') || q.includes('confirm')) return 'nomination';
  return 'other';
}

async function cgFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${API_KEY}`);
  if (!res.ok) throw new Error(`Congress.gov fetch failed ${path}: ${res.status}`);
  return res.json();
}

async function fetchVoteList() {
  const votes = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const data = await cgFetch(`/house-vote/${CONGRESS}/${SESSION}?limit=${limit}&offset=${offset}`);
    const batch = data?.houseVotes ?? [];
    votes.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return votes;
}

async function getAlreadyIngested(client) {
  const { rows } = await client.query(
    `SELECT vote_number FROM vote_records WHERE chamber = 'house' AND congress = $1 AND session_num = $2`,
    [CONGRESS, SESSION]
  );
  return new Set(rows.map(r => r.vote_number));
}

export async function ingestHouseVotes({ verbose = false } = {}) {
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const alreadyIngested = await getAlreadyIngested(client);
    const voteList = await fetchVoteList();

    if (verbose) console.log(`House: ${voteList.length} votes in list, ${alreadyIngested.size} already ingested`);

    for (const voteEntry of voteList) {
      const voteNumber = parseInt(voteEntry.voteNumber ?? voteEntry.rollNumber, 10);
      if (!voteNumber || alreadyIngested.has(voteNumber)) continue;

      const questionText = voteEntry.question ?? '';
      if (shouldSkip(questionText)) {
        skipped++;
        continue;
      }

      try {
        const detail = await cgFetch(`/house-vote/${CONGRESS}/${SESSION}/${voteNumber}/members`);
        const memberVotes = detail?.voteMembers ?? [];

        const voteDate = voteEntry.voteDate
          ? new Date(voteEntry.voteDate).toISOString().slice(0, 10)
          : null;
        const category = categorizePurpose(questionText);

        // Build party majority positions
        const partyTotals = {};
        for (const mv of memberVotes) {
          const party = mv.party;
          const vc = mv.voteCast ?? mv.votePosition;
          if (!partyTotals[party]) partyTotals[party] = { yea: 0, nay: 0 };
          if (vc === 'Yea' || vc === 'Yes' || vc === 'Aye') partyTotals[party].yea++;
          else if (vc === 'Nay' || vc === 'No') partyTotals[party].nay++;
        }

        for (const mv of memberVotes) {
          const bioguideId = mv.bioguideId ?? mv.memberId;
          if (!bioguideId) continue;

          const rawCast = mv.voteCast ?? mv.votePosition ?? '';
          // Normalize vote cast to canonical form
          const voteCast = (['Yea', 'Yes', 'Aye'].includes(rawCast)) ? 'Yea'
            : (['Nay', 'No'].includes(rawCast)) ? 'Nay'
            : rawCast || 'Not Voting';

          const party = mv.party;
          const partyMajority = partyTotals[party]
            ? (partyTotals[party].yea >= partyTotals[party].nay ? 'Yea' : 'Nay')
            : null;

          await client.query(
            `INSERT INTO vote_records (member_id, vote_date, chamber, congress, session_num, vote_number, vote_cast, party_vote, vote_category)
             VALUES ($1, $2, 'house', $3, $4, $5, $6, $7, $8)
             ON CONFLICT (member_id, congress, session_num, vote_number) DO NOTHING`,
            [bioguideId, voteDate, CONGRESS, SESSION, voteNumber, voteCast, partyMajority, category]
          );
          inserted++;
        }
      } catch (err) {
        if (verbose) console.error(`  Error on House vote ${voteNumber}:`, err.message);
        errors++;
      }
    }

    return { inserted, skipped, errors };
  } finally {
    client.release();
  }
}

// Allow running directly: node ingestHouseVotes.js
if (process.argv[1].endsWith('ingestHouseVotes.js')) {
  ingestHouseVotes({ verbose: true })
    .then(r => { console.log('Done:', r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
