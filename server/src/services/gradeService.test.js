import { describe, it, expect } from 'vitest';
import {
  calculateAttendanceScore,
  calculatePartyIndependenceScore,
  calculateCompositeScore,
  letterGrade,
} from './gradeService.js';

describe('calculateAttendanceScore', () => {
  it('returns 100 minus missed_votes_pct', () => {
    expect(calculateAttendanceScore(5)).toBe(95);
  });
  it('returns 0 when missed_votes_pct is 100', () => {
    expect(calculateAttendanceScore(100)).toBe(0);
  });
  it('clamps to 0 for values above 100', () => {
    expect(calculateAttendanceScore(120)).toBe(0);
  });
  it('clamps to 100 for negative values', () => {
    expect(calculateAttendanceScore(-5)).toBe(100);
  });
});

describe('calculatePartyIndependenceScore', () => {
  it('returns 100 minus votes_with_party_pct', () => {
    expect(calculatePartyIndependenceScore(90)).toBe(10);
  });
  it('returns 100 when member never votes with party', () => {
    expect(calculatePartyIndependenceScore(0)).toBe(100);
  });
});

describe('calculateCompositeScore', () => {
  it('averages two dimension scores', () => {
    expect(calculateCompositeScore(80, 60)).toBe(70);
  });
  it('rounds to nearest integer', () => {
    expect(calculateCompositeScore(81, 80)).toBe(81);
  });
});

describe('letterGrade', () => {
  it('assigns A for 90 and above', () => {
    expect(letterGrade(90)).toBe('A');
    expect(letterGrade(100)).toBe('A');
  });
  it('assigns B for 80-89', () => {
    expect(letterGrade(80)).toBe('B');
    expect(letterGrade(89)).toBe('B');
  });
  it('assigns C for 70-79', () => {
    expect(letterGrade(75)).toBe('C');
  });
  it('assigns D for 60-69', () => {
    expect(letterGrade(65)).toBe('D');
  });
  it('assigns F below 60', () => {
    expect(letterGrade(59)).toBe('F');
    expect(letterGrade(0)).toBe('F');
  });
});
