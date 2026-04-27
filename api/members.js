import { getPool } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { chamber } = req.query;
    let query = `
      SELECT m.id, m.first_name, m.last_name, m.party, m.state, m.chamber,
             m.district, m.photo_url,
             g.composite_score, g.letter_grade, g.data_sufficient,
             g.attendance_score, g.party_independence_score,
             g.legislative_score, g.campaign_finance_score, g.bipartisan_score,
             g.total_votes_eligible, g.votes_cast,
             g.score_window_start, g.score_window_end
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
    const { rows } = await getPool().query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members', code: 'DB_ERROR' });
  }
}
