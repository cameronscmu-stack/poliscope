import db from '../db/client.js';

export async function getAllMembers(chamber) {
  let query = `
    SELECT m.id, m.first_name, m.last_name, m.party, m.state, m.chamber,
           m.district, m.photo_url, g.composite_score, g.letter_grade, g.data_sufficient
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
  const { rows } = await db.query(query, params);
  return rows;
}

export async function getMemberById(id) {
  const { rows } = await db.query(`
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
  return rows[0] ?? null;
}
