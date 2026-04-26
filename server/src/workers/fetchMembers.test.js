import { describe, it, expect } from 'vitest';
import { transformMember } from './fetchMembers.js';

const RAW_SENATE = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  district: null,
  in_office: true,
  url: 'https://alexander.senate.gov',
  missed_votes_pct: 3.22,
  votes_with_party_pct: 87.18,
};

describe('transformMember', () => {
  it('maps ProPublica fields to DB schema', () => {
    const result = transformMember(RAW_SENATE, 'senate');
    expect(result.id).toBe('A000360');
    expect(result.chamber).toBe('senate');
    expect(result.party).toBe('R');
    expect(result.missed_votes_pct).toBe(3.22);
    expect(result.votes_with_party_pct).toBe(87.18);
  });

  it('generates photo_url from bioguide id', () => {
    const result = transformMember(RAW_SENATE, 'senate');
    expect(result.photo_url).toBe(
      'https://theunitedstates.io/images/congress/225x275/A000360.jpg'
    );
  });

  it('defaults numeric pcts to 0 when missing', () => {
    const raw = { ...RAW_SENATE, missed_votes_pct: undefined, votes_with_party_pct: undefined };
    const result = transformMember(raw, 'senate');
    expect(result.missed_votes_pct).toBe(0);
    expect(result.votes_with_party_pct).toBe(0);
  });
});
