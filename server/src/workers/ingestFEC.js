import pool from '../db/client.js';

const FEC_KEY = process.env.FEC_API_KEY;
const FEC_BASE = 'https://api.open.fec.gov/v1';
const ELECTION_YEAR = 2024;

async function fecFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FEC_BASE}${path}${sep}api_key=${FEC_KEY}&per_page=20`);
  if (!res.ok) throw new Error(`FEC fetch failed ${path}: ${res.status}`);
  return res.json();
}

function nameSimilarity(a, b) {
  // Simple: does b start with a or contain a?
  const an = a.toLowerCase().trim();
  const bn = b.toLowerCase().trim();
  return bn.includes(an) || an.includes(bn);
}

async function findFecCandidateId(lastName, state, office) {
  try {
    const data = await fecFetch(
      `/candidates/?office=${office}&state=${state}&election_year=${ELECTION_YEAR}&sort=-receipts`
    );
    const results = data?.results ?? [];
    const match = results.find(c => nameSimilarity(lastName, c.name));
    return match?.candidate_id ?? null;
  } catch {
    return null;
  }
}

async function fetchFinanceTotals(fecId) {
  try {
    const data = await fecFetch(`/candidate/${fecId}/totals/?cycle=${ELECTION_YEAR}`);
    const r = data?.results?.[0];
    if (!r) return null;
    return {
      receipts: r.receipts ?? 0,
      individual_unitemized: r.individual_unitemized_contributions ?? 0,
      pac: r.other_political_committee_contributions ?? 0,
    };
  } catch {
    return null;
  }
}

function calcFinanceScore(totals) {
  if (!totals || totals.receipts === 0) return null;
  const smallDonorPct = totals.individual_unitemized / totals.receipts;
  const pacPct = totals.pac / totals.receipts;
  return (smallDonorPct * 0.6 + (1 - pacPct) * 0.4) * 100;
}

export async function ingestFEC({ verbose = false } = {}) {
  const client = await pool.connect();
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  try {
    const { rows: members } = await client.query(
      `SELECT id, last_name, state, chamber, fec_candidate_id FROM members WHERE in_office = true`
    );

    for (const member of members) {
      try {
        let fecId = member.fec_candidate_id;

        if (!fecId) {
          const office = member.chamber === 'senate' ? 'S' : 'H';
          fecId = await findFecCandidateId(member.last_name, member.state, office);
          if (fecId) {
            await client.query(
              `UPDATE members SET fec_candidate_id = $1 WHERE id = $2`,
              [fecId, member.id]
            );
          }
        }

        if (!fecId) { notFound++; continue; }

        const totals = await fetchFinanceTotals(fecId);
        const financeScore = calcFinanceScore(totals);
        if (financeScore === null) { notFound++; continue; }

        await client.query(
          `INSERT INTO grade_scores (member_id, campaign_finance_score, calculated_at, updated_at)
           VALUES ($1, $2, now(), now())
           ON CONFLICT (member_id) DO UPDATE SET
             campaign_finance_score = EXCLUDED.campaign_finance_score,
             updated_at = now()`,
          [member.id, financeScore]
        );
        updated++;

        if (verbose) console.log(`  ${member.id} (${member.last_name}): finance=${financeScore.toFixed(1)}`);
      } catch (err) {
        if (verbose) console.error(`  Error for ${member.id}:`, err.message);
        errors++;
      }
    }

    return { updated, notFound, errors };
  } finally {
    client.release();
  }
}

if (process.argv[1].endsWith('ingestFEC.js')) {
  ingestFEC({ verbose: true })
    .then(r => { console.log('Done:', r); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
