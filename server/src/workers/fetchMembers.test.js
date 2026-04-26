import { describe, it, expect } from 'vitest';
import { transformMember } from './fetchMembers.js';

const RAW_SENATE = {
  bioguideId: 'A000360',
  name: 'Alexander, Lamar',
  partyName: 'Republican',
  state: 'Tennessee',
  district: null,
  depiction: null,
  terms: {
    item: [{ chamber: 'Senate' }],
  },
};

const RAW_HOUSE = {
  bioguideId: 'B001234',
  name: 'Brown, Jane A.',
  partyName: 'Democrat',
  state: 'California',
  district: 12,
  depiction: { imageUrl: 'https://example.com/photo.jpg' },
  terms: {
    item: [{ chamber: 'House of Representatives' }],
  },
};

describe('transformMember', () => {
  it('maps Congress.gov fields to DB schema', () => {
    const result = transformMember(RAW_SENATE);
    expect(result.id).toBe('A000360');
    expect(result.first_name).toBe('Lamar');
    expect(result.last_name).toBe('Alexander');
    expect(result.party).toBe('R');
    expect(result.state).toBe('TN');
    expect(result.chamber).toBe('senate');
    expect(result.in_office).toBe(true);
  });

  it('generates fallback photo_url from bioguide id', () => {
    const result = transformMember(RAW_SENATE);
    expect(result.photo_url).toBe(
      'https://theunitedstates.io/images/congress/225x275/A000360.jpg'
    );
  });

  it('uses depiction imageUrl when present', () => {
    const result = transformMember(RAW_HOUSE);
    expect(result.photo_url).toBe('https://example.com/photo.jpg');
  });

  it('maps House chamber correctly', () => {
    const result = transformMember(RAW_HOUSE);
    expect(result.chamber).toBe('house');
    expect(result.party).toBe('D');
    expect(result.state).toBe('CA');
    expect(result.district).toBe(12);
  });

  it('returns null chamber for non-voting delegates', () => {
    const raw = { ...RAW_SENATE, terms: { item: [{ chamber: 'Unknown' }] } };
    const result = transformMember(raw);
    expect(result.chamber).toBeNull();
  });
});
