const BASE = 'https://api.congress.gov/v3';
const key = () => process.env.CONGRESS_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id } = req.query;

  try {
    const [bioRes, billsRes] = await Promise.all([
      fetch(`${BASE}/member/${id}?format=json&api_key=${key()}`),
      fetch(`${BASE}/member/${id}/sponsored-legislation?format=json&limit=10&api_key=${key()}`),
    ]);

    if (!bioRes.ok) return res.status(404).json({ error: 'Member not found' });

    const [bioData, billsData] = await Promise.all([
      bioRes.json(),
      billsRes.ok ? billsRes.json() : Promise.resolve({ sponsoredLegislation: [] }),
    ]);

    const bio = bioData.member ?? {};
    const rawTerms = bio.terms?.item ?? [];
    const terms = (Array.isArray(rawTerms) ? rawTerms : [rawTerms]).map(t => ({
      congress: t.congress,
      chamber: t.chamber,
      startYear: t.startYear,
      endYear: t.endYear ?? null,
    }));

    const addr = bio.addressInformation ?? {};
    const office = {
      phone: addr.officeTelephone ?? null,
      address: addr.officeAddress ?? null,
      city: addr.city ?? null,
      zip: addr.zipCode ?? null,
    };

    const bills = (billsData.sponsoredLegislation ?? []).slice(0, 8).map(b => ({
      congress: b.congress,
      type: b.type,
      number: b.number,
      title: b.title,
      introduced: b.introducedDate ?? null,
      latestAction: b.latestAction?.text ?? null,
      policyArea: b.policyArea?.name ?? null,
      url: b.url ?? null,
    }));

    res.json({ terms, office, bills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
}
