import { XMLParser } from 'fast-xml-parser';
import pool from '../db/client.js';

const CONGRESS = 119;
const SESSION = 1;
const VOTE_LIST_URL = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${SESSION}.xml`;

// Votes to skip — not real legislative votes
const SKIP_QUESTIONS = [
  'quorum',
  'adjourn',
  'adjournment',
  'recess',
  'executive session',
];

function getQuestionText(entry) {
  if (typeof entry.question === 'string') return entry.question;
  return typeof entry.title === 'string' ? entry.title : '';
}

function shouldSkip(questionText) {
  if (!questionText) return false;
  const q = questionText.toLowerCase();
  return SKIP_QUESTIONS.some(word => q.includes(word));
}

function parsePartyMajority(parties) {
  // parties is the <count> block from the vote detail XML
  // Returns 'Yea' | 'Nay' | null based on which position the party bloc majority held
  if (!parties) return null;
  const list = Array.isArray(parties) ? parties : [parties];
  const yeas = list.reduce((s, p) => s + (parseInt(p.yea_count, 10) || 0), 0);
  const nays = list.reduce((s, p) => s + (parseInt(p.nay_count, 10) || 0), 0);
  if (yeas === 0 && nays === 0) return null;
  return yeas >= nays ? 'Yea' : 'Nay';
}

async function fetchVoteList() {
  const res = await fetch(VOTE_LIST_URL);
  if (!res.ok) throw new Error(`Senate vote list fetch failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`Senate vote detail fetch failed (${voteNumber}): ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  return parser.parse(xml);
}

async function getAlreadyIngested(client) {
  const { rows } = await client.query(
    `SELECT vote_number FROM vote_records WHERE chamber = 'senate' AND congress = $1 AND session_num = $2`,
    [CONGRESS, SESSION]
  );
  return new Set(rows.map(r => r.vote_number));
}

async function lookupMemberId(client, lastName, state, party) {
  const { rows } = await client.query(
    `SELECT id FROM members WHERE UPPER(last_name) = UPPER($1) AND state = UPPER($2) AND party = UPPER($3) AND chamber = 'senate' AND in_office = true LIMIT 1`,
    [lastName, state, party]
  );
  return rows[0]?.id ?? null;
}

function categorizePurpose(questionText) {
  if (!questionText) return 'other';
  const q = questionText.toLowerCase();
  if (q.includes('passage') || q.includes('pass')) return 'passage';
  if (q.includes('amendment') || q.includes('amdt')) return 'amendment';
  if (q.includes('cloture') || q.includes('motion to proceed') || q.includes('proceed')) return 'procedural';
  if (q.includes('nomination') || q.includes('confirm')) return 'nomination';
  if (q.includes('treaty')) return 'treaty';
  return 'other';
}

export async function ingestSenateVotes({ verbose = false } = {}) {
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const alreadyIngested = await getAlreadyIngested(client);
    const voteList = await fetchVoteList();

    if (verbose) console.log(`Senate: ${voteList.length} votes in list, ${alreadyIngested.size} already ingested`);

    for (const voteEntry of voteList) {
      const voteNumber = parseInt(voteEntry.vote_number, 10);
      if (!voteNumber || alreadyIngested.has(voteNumber)) continue;

      const questionText = getQuestionText(voteEntry);
      if (shouldSkip(questionText)) {
        skipped++;
        continue;
      }

      try {
        const detail = await fetchVoteDetail(voteNumber);
        const voteData = detail?.roll_call_vote;
        if (!voteData) continue;

        const voteDate = voteData.vote_date
          ? new Date(voteData.vote_date).toISOString().slice(0, 10)
          : null;
        const category = categorizePurpose(typeof voteData.question === 'string' ? voteData.question : questionText);

        // Compute overall party majority position from party count blocks
        const members = voteData?.members?.member ?? [];
        const memberList = Array.isArray(members) ? members : [members];

        // Build party → {yea, nay} totals to determine majority position
        const partyTotals = {};
        for (const m of memberList) {
          const p = m.party ?? 'I';
          const vc = m.vote_cast ?? '';
          if (!partyTotals[p]) partyTotals[p] = { yea: 0, nay: 0 };
          if (vc === 'Yea') partyTotals[p].yea++;
          else if (vc === 'Nay') partyTotals[p].nay++;
        }

        for (const m of memberList) {
          const lastName = m.last_name;
          const state = m.state;
          const party = m.party;
          const voteCast = m.vote_cast;
          if (!lastName || !state || !voteCast) continue;

          const memberId = await lookupMemberId(client, lastName, state, party ?? 'I');
          if (!memberId) continue;

          const partyMajority = partyTotals[party]
            ? (partyTotals[party].yea >= partyTotals[party].nay ? 'Yea' : 'Nay')
            : null;

          await client.query(
            `INSERT INTO vote_records (member_id, vote_date, chamber, congress, session_num, vote_number, vote_cast, party_vote, vote_category)
             VALUES ($1, $2, 'senate', $3, $4, $5, $6, $7, $8)
             ON CONFLICT (member_id, congress, session_num, vote_number) DO NOTHING`,
            [memberId, voteDate, CONGRESS, SESSION, voteNumber, voteCast, partyMajority, category]
          );
          inserted++;
        }
      } catch (err) {
        if (verbose) console.error(`  Error on vote ${voteNumber}:`, err.message);
        errors++;
      }
    }

    return { inserted, skipped, errors };
  } finally {
    client.release();
  }
}

// Allow running directly: node ingestSenateVotes.js
if (process.argv[1].endsWith('ingestSenateVotes.js')) {
  ingestSenateVotes({ verbose: true })
    .then(r => { console.log('Done:', r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
