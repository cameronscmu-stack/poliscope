import db from '../db/client.js';
import {
  calculateAttendanceScore,
  calculatePartyIndependenceScore,
  calculateCompositeScore,
  letterGrade,
} from '../services/gradeService.js';

const BASE_URL = 'https://api.propublica.org/congress/v1';
const CURRENT_CONGRESS = 119;

export function transformMember(raw, chamber) {
  return {
    id: raw.id,
    first_name: raw.first_name,
    last_name: raw.last_name,
    party: raw.party,
    state: raw.state,
    chamber,
    district: raw.district ? parseInt(raw.district, 10) : null,
    in_office: raw.in_office ?? true,
    photo_url: `https://theunitedstates.io/images/congress/225x275/${raw.id}.jpg`,
    website: raw.url ?? null,
    missed_votes_pct: parseFloat(raw.missed_votes_pct) || 0,
    votes_with_party_pct: parseFloat(raw.votes_with_party_pct) || 0,
  };
}

async function fetchChamber(chamber) {
  const res = await fetch(
    `${BASE_URL}/${CURRENT_CONGRESS}/${chamber}/members.json`,
    { headers: { 'X-API-Key': process.env.PROPUBLICA_API_KEY } }
  );
  if (!res.ok) throw new Error(`ProPublica ${chamber} fetch failed: ${res.status}`);
  const data = await res.json();
  return data.results[0].members;
}

async function upsertMember(member) {
  await db.query(`
    INSERT INTO members
      (id, first_name, last_name, party, state, chamber, district, in_office, photo_url, website)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name  = EXCLUDED.last_name,
      party      = EXCLUDED.party,
      state      = EXCLUDED.state,
      in_office  = EXCLUDED.in_office,
      photo_url  = EXCLUDED.photo_url,
      website    = EXCLUDED.website,
      updated_at = NOW()
  `, [
    member.id, member.first_name, member.last_name, member.party,
    member.state, member.chamber, member.district, member.in_office,
    member.photo_url, member.website,
  ]);
}

async function upsertGrade(member) {
  const attendanceScore = calculateAttendanceScore(member.missed_votes_pct);
  const partyIndependenceScore = calculatePartyIndependenceScore(member.votes_with_party_pct);
  const compositeScore = calculateCompositeScore(attendanceScore, partyIndependenceScore);
  const grade = letterGrade(compositeScore);

  await db.query(`
    INSERT INTO grade_scores
      (member_id, attendance_score, party_independence_score, composite_score, letter_grade, data_sufficient, calculated_at)
    VALUES ($1, $2, $3, $4, $5, true, NOW())
    ON CONFLICT (member_id) DO UPDATE SET
      attendance_score         = EXCLUDED.attendance_score,
      party_independence_score = EXCLUDED.party_independence_score,
      composite_score          = EXCLUDED.composite_score,
      letter_grade             = EXCLUDED.letter_grade,
      calculated_at            = NOW(),
      updated_at               = NOW()
  `, [member.id, attendanceScore, partyIndependenceScore, compositeScore, grade]);
}

export async function runMemberIngestion() {
  console.log('[worker] Starting member ingestion...');
  const [senateRaw, houseRaw] = await Promise.all([
    fetchChamber('senate'),
    fetchChamber('house'),
  ]);

  const all = [
    ...senateRaw.map(m => transformMember(m, 'senate')),
    ...houseRaw.map(m => transformMember(m, 'house')),
  ];

  for (const member of all) {
    await upsertMember(member);
    await upsertGrade(member);
  }

  console.log(`[worker] Ingested ${all.length} members`);
}
