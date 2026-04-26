import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { startScheduler } from './workers/scheduler.js';
import { runMemberIngestion } from './workers/fetchMembers.js';

const PORT = process.env.PORT || 3001;
const app = createApp();

app.listen(PORT, async () => {
  console.log(`Poliscope server running on http://localhost:${PORT}`);
  startScheduler();

  // Seed on startup if DB is empty
  const { default: db } = await import('./db/client.js');
  const { rows } = await db.query('SELECT COUNT(*) FROM members');
  if (parseInt(rows[0].count, 10) === 0) {
    console.log('[startup] DB empty — running initial member ingestion...');
    await runMemberIngestion();
  }
});
