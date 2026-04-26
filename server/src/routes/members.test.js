import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/memberService.js', () => ({
  getAllMembers: vi.fn(),
  getMemberById: vi.fn(),
}));

import { getAllMembers, getMemberById } from '../services/memberService.js';

const MOCK_MEMBER = {
  id: 'A000360',
  first_name: 'Lamar',
  last_name: 'Alexander',
  party: 'R',
  state: 'TN',
  chamber: 'senate',
  district: null,
  composite_score: 72,
  letter_grade: 'C',
};

describe('GET /api/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with member array', async () => {
    getAllMembers.mockResolvedValue([MOCK_MEMBER]);
    const res = await request(createApp()).get('/api/members');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('A000360');
  });

  it('passes chamber query param to service', async () => {
    getAllMembers.mockResolvedValue([]);
    await request(createApp()).get('/api/members?chamber=senate');
    expect(getAllMembers).toHaveBeenCalledWith('senate');
  });

  it('returns 500 when service throws', async () => {
    getAllMembers.mockRejectedValue(new Error('DB down'));
    const res = await request(createApp()).get('/api/members');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('DB_ERROR');
  });
});

describe('GET /api/members/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns member when found', async () => {
    getMemberById.mockResolvedValue(MOCK_MEMBER);
    const res = await request(createApp()).get('/api/members/A000360');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('A000360');
  });

  it('returns 404 when member not found', async () => {
    getMemberById.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/members/NOTEXIST');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
