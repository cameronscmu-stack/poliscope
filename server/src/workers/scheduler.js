import cron from 'node-cron';
import { runMemberIngestion } from './fetchMembers.js';

export function startScheduler() {
  // Run member ingestion daily at 6am UTC
  cron.schedule('0 6 * * *', async () => {
    try {
      await runMemberIngestion();
    } catch (err) {
      console.error('[scheduler] Member ingestion failed:', err.message);
    }
  });

  console.log('[scheduler] Cron jobs registered');
}
