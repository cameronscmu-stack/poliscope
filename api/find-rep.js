import { getPool } from './_db.js';

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { address } = req.query;
  if (!address?.trim()) return res.status(400).json({ error: 'address required' });

  try {
    const params = new URLSearchParams({
      address: address.trim(),
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      layers: '54',
      format: 'json',
    });

    const geoRes = await fetch(`${CENSUS_URL}?${params}`);
    const geoData = await geoRes.json();

    const match = geoData.result?.addressMatches?.[0];
    if (!match) return res.status(404).json({ error: 'Address not recognized — try including city and state.' });

    const state = match.addressComponents?.state;
    if (!state) return res.status(404).json({ error: 'Could not determine state from address.' });

    const cdList = match.geographies?.['Congressional Districts'] ?? [];
    const districtNum = cdList[0] ? parseInt(cdList[0].BASENAME, 10) : null;

    const pool = getPool();

    const [{ rows: senators }, { rows: reps }] = await Promise.all([
      pool.query(
        `SELECT id, first_name, last_name, party, state, chamber, district, photo_url
         FROM members WHERE state = $1 AND chamber = 'senate' AND in_office = true
         ORDER BY last_name`,
        [state]
      ),
      districtNum !== null
        ? pool.query(
            `SELECT id, first_name, last_name, party, state, chamber, district, photo_url
             FROM members WHERE state = $1 AND chamber = 'house' AND district = $2 AND in_office = true`,
            [state, districtNum]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      state,
      district: districtNum,
      matchedAddress: match.matchedAddress,
      senators,
      representative: reps[0] ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lookup failed', detail: err.message });
  }
}
