import { Router } from 'express';
import { getAllMembers, getMemberById } from '../services/memberService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const members = await getAllMembers(req.query.chamber);
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members', code: 'DB_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const member = await getMemberById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found', code: 'NOT_FOUND' });
    res.json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch member', code: 'DB_ERROR' });
  }
});

export default router;
