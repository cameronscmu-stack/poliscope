import { getPool } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const {
    stage = 'all',
    chamber = 'all',
    area = 'all',
    limit = '30',
    offset = '0',
  } = req.query;

  try {
    const params = [];
    let where = 'WHERE 1=1';

    if (stage !== 'all') {
      params.push(stage);
      where += ` AND action_stage = $${params.length}`;
    }
    if (chamber !== 'all') {
      params.push(chamber.toLowerCase());
      where += ` AND origin_chamber = $${params.length}`;
    }
    if (area !== 'all') {
      params.push(area);
      where += ` AND policy_area = $${params.length}`;
    }

    params.push(Math.min(parseInt(limit) || 30, 100));
    params.push(parseInt(offset) || 0);

    const { rows } = await getPool().query(
      `SELECT id, congress, bill_type, bill_number, title, summary, policy_area,
              origin_chamber, latest_action_date, latest_action_text, action_stage,
              update_date, introduced_date, sponsors
       FROM legislation
       ${where}
       ORDER BY update_date DESC NULLS LAST, latest_action_date DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Return distinct policy areas for filter UI
    const { rows: areas } = await getPool().query(
      `SELECT DISTINCT policy_area FROM legislation WHERE policy_area IS NOT NULL ORDER BY policy_area`
    );

    res.json({ bills: rows, areas: areas.map(r => r.policy_area) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch legislation', code: 'DB_ERROR' });
  }
}
