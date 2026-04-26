import express from 'express';
import cors from 'cors';
import membersRouter from './routes/members.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/members', membersRouter);

  return app;
}
