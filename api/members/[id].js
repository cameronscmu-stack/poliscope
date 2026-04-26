import { getPool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { id } = req.query;
    const { rows } = await getPool().query(`
      SELECT
        m.*,
        g.attendance_score,
        g.party_independence_score,
        g.composite_score,
        g.letter_grade,
        g.data_sufficient,
        g.calculated_at AS grade_calculated_at
      FROM members m
      LEFT JOIN grade_scores g ON g.member_id = m.id
      WHERE m.id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Member not found', code: 'NOT_FOUND' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch member', code: 'DB_ERROR' });
  }
}
