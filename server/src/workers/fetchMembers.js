import db from '../db/client.js';

const BASE_URL = 'https://api.congress.gov/v3';

const STATE_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  'American Samoa': 'AS', 'Guam': 'GU', 'Northern Mariana Islands': 'MP',
  'Puerto Rico': 'PR', 'Virgin Islands': 'VI',
};

const PARTY_CODE = { 'Democrat': 'D', 'Republican': 'R', 'Independent': 'I' };

function parseName(fullName) {
  // Congress.gov format: "Smith, John A."
  const idx = fullName.indexOf(', ');
  if (idx === -1) return { last: fullName, first: '' };
  return { last: fullName.slice(0, idx), first: fullName.slice(idx + 2) };
}

function getChamber(raw) {
  const terms = raw.terms?.item;
  if (!terms) return null;
  const list = Array.isArray(terms) ? terms : [terms];
  const last = list[list.length - 1];
  if (last?.chamber?.includes('Senate')) return 'senate';
  if (last?.chamber?.includes('House')) return 'house';
  return null;
}

export function transformMember(raw) {
  const { first, last } = parseName(raw.name || '');
  return {
    id: raw.bioguideId,
    first_name: first,
    last_name: last,
    party: PARTY_CODE[raw.partyName] ?? raw.partyName?.[0] ?? 'I',
    state: STATE_ABBR[raw.state] ?? raw.state,
    chamber: getChamber(raw),
    district: raw.district ?? null,
    in_office: true,
    photo_url: raw.depiction?.imageUrl ??
      `https://theunitedstates.io/images/congress/225x275/${raw.bioguideId}.jpg`,
    website: null,
  };
}

async function fetchAllMembers() {
  const all = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const url = `${BASE_URL}/member?format=json&limit=${limit}&offset=${offset}&currentMember=true&api_key=${process.env.CONGRESS_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Congress.gov fetch failed: ${res.status}`);
    const data = await res.json();
    const batch = data.members ?? [];
    all.push(...batch);
    if (!data.pagination?.next || batch.length < limit) break;
    offset += limit;
  }

  return all;
}

async function upsertMember(member) {
  if (!member.chamber) return; // skip delegates/non-voting members
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
      updated_at = NOW()
  `, [
    member.id, member.first_name, member.last_name, member.party,
    member.state, member.chamber, member.district, member.in_office,
    member.photo_url, member.website,
  ]);
}

export async function runMemberIngestion() {
  console.log('[worker] Starting member ingestion from Congress.gov...');
  const raw = await fetchAllMembers();
  const members = raw.map(transformMember).filter(m => m.chamber);

  for (const member of members) {
    await upsertMember(member);
  }

  console.log(`[worker] Ingested ${members.length} members`);
}
