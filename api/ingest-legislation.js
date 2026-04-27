import { getPool } from './_db.js';

const BASE = 'https://api.congress.gov/v3';
const CONGRESS = 119;

async function cgFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${process.env.CONGRESS_API_KEY}`);
  if (!res.ok) throw new Error(`Congress.gov ${path}: ${res.status}`);
  return res.json();
}

function classifyStage(text) {
  if (!text) return 'introduced';
  const t = text.toLowerCase();
  if (t.includes('became public law') || t.includes('signed by president') || t.includes('signed into law')) return 'signed';
  if (t.includes('vetoed')) return 'vetoed';
  if (
    t.includes('passed senate') || t.includes('passed house') ||
    t.includes('agreed to in senate') || t.includes('agreed to in house') ||
    t.includes('passed the senate') || t.includes('passed the house')
  ) return 'passed';
  if (
    t.includes('placed on calendar') || t.includes('floor consideration') ||
    t.includes('rule filed') || t.includes('scheduled for') ||
    t.includes('considered and passed')
  ) return 'floor';
  if (
    t.includes('reported by') || t.includes('ordered reported') ||
    t.includes('ordered to be reported') || t.includes('committee discharged')
  ) return 'reported';
  if (t.includes('referred to')) return 'committee';
  return 'introduced';
}

function stripHtml(str) {
  return (str ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  const secret = req.headers['authorization'];
  if (process.env.INGEST_SECRET && secret !== `Bearer ${process.env.INGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();
  const daysBack = parseInt(req.query?.days ?? '60', 10);
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 1. Build summary map from /summaries endpoint
  const summaryMap = {};
  try {
    let offset = 0;
    while (true) {
      const data = await cgFetch(
        `/summaries/${CONGRESS}?fromDateTime=${since}T00:00:00Z&sort=updateDate+desc&limit=250&offset=${offset}`
      );
      const items = data?.summaries ?? [];
      for (const s of items) {
        const key = `${s.bill?.congress}-${s.bill?.type}-${s.bill?.number}`;
        if (!summaryMap[key]) {
          summaryMap[key] = stripHtml(s.text).slice(0, 600);
        }
      }
      if (items.length < 250) break;
      offset += 250;
    }
  } catch (err) {
    console.error('Summaries fetch error:', err.message);
  }

  // 2. Fetch and upsert bills
  let upserted = 0;
  let offset = 0;

  while (true) {
    const data = await cgFetch(
      `/bill/${CONGRESS}?sort=updateDate+desc&limit=250&offset=${offset}&fromDateTime=${since}T00:00:00Z`
    );
    const bills = data?.bills ?? [];
    if (bills.length === 0) break;

    for (const b of bills) {
      const key = `${CONGRESS}-${b.type}-${b.number}`;
      const summary = summaryMap[key] ?? null;
      const stage = classifyStage(b.latestAction?.text);
      const sponsor = b.sponsors?.[0] ?? null;
      const sponsorsJson = sponsor
        ? JSON.stringify([{ id: sponsor.bioguideId, name: sponsor.fullName, party: sponsor.party, state: sponsor.state }])
        : null;

      await pool.query(
        `INSERT INTO legislation
           (id, congress, bill_type, bill_number, title, summary, policy_area,
            origin_chamber, latest_action_date, latest_action_text, action_stage,
            update_date, introduced_date, sponsors, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
         ON CONFLICT (id) DO UPDATE SET
           title               = EXCLUDED.title,
           summary             = COALESCE(EXCLUDED.summary, legislation.summary),
           latest_action_date  = EXCLUDED.latest_action_date,
           latest_action_text  = EXCLUDED.latest_action_text,
           action_stage        = EXCLUDED.action_stage,
           update_date         = EXCLUDED.update_date,
           sponsors            = EXCLUDED.sponsors,
           updated_at          = now()`,
        [
          key, CONGRESS, b.type, b.number, b.title, summary,
          b.policyArea?.name ?? null,
          b.originChamber?.toLowerCase() ?? null,
          b.latestAction?.actionDate ?? null,
          b.latestAction?.text ?? null,
          stage,
          b.updateDate?.slice(0, 10) ?? null,
          b.introducedDate ?? null,
          sponsorsJson,
        ]
      );
      upserted++;
    }

    if (bills.length < 250) break;
    offset += 250;
  }

  res.json({ ok: true, upserted, summaries: Object.keys(summaryMap).length });
}
