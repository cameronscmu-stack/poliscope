import { describe, it, expect } from 'vitest';
import { filterMembers } from './Home';

const members = [
  { first_name: 'Nancy', last_name: 'Pelosi', party: 'D', state: 'CA', letter_grade: 'A' },
  { first_name: 'Mitch', last_name: 'McConnell', party: 'R', state: 'KY', letter_grade: 'C' },
  { first_name: 'Bernie', last_name: 'Sanders', party: 'I', state: 'VT', letter_grade: 'B' },
];

const noFilters = { party: 'all', stateFilter: 'all', gradeFilter: 'all', searchQuery: '' };

describe('filterMembers', () => {
  it('returns all members when no filters active', () => {
    expect(filterMembers(members, noFilters)).toHaveLength(3);
  });

  it('filters by party', () => {
    const result = filterMembers(members, { ...noFilters, party: 'D' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Pelosi');
  });

  it('filters by state', () => {
    const result = filterMembers(members, { ...noFilters, stateFilter: 'KY' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('McConnell');
  });

  it('filters by grade', () => {
    const result = filterMembers(members, { ...noFilters, gradeFilter: 'B' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Sanders');
  });

  it('filters by name search (case-insensitive)', () => {
    const result = filterMembers(members, { ...noFilters, searchQuery: 'pel' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Pelosi');
  });

  it('filters by state search (case-insensitive)', () => {
    const result = filterMembers(members, { ...noFilters, searchQuery: 'vt' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Sanders');
  });

  it('filters by party display name search', () => {
    const result = filterMembers(members, { ...noFilters, searchQuery: 'democrat' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('Pelosi');
  });

  it('combines multiple filters', () => {
    const result = filterMembers(members, { party: 'R', stateFilter: 'KY', gradeFilter: 'all', searchQuery: '' });
    expect(result).toHaveLength(1);
    expect(result[0].last_name).toBe('McConnell');
  });

  it('returns empty array when no members match', () => {
    const result = filterMembers(members, { ...noFilters, searchQuery: 'zzznomatch' });
    expect(result).toHaveLength(0);
  });
});
