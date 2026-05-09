import cron from 'node-cron';
import { db } from '../database/index.js';
import { startCronTasks } from '../tasks/cronTasks.js';

export function startScheduler() {
  // Daily digest job
  cron.schedule('0 9 * * *', () => {
    console.log('Running daily digest job');
    // In a real implementation, this would send daily summaries to users
  });

  // Cleanup old sessions job
  cron.schedule('0 2 * * *', () => {
    console.log('Running session cleanup job');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare('DELETE FROM sessions WHERE last_active < ?').run(sevenDaysAgo);
    console.log(`Cleaned up ${result.changes} old sessions`);
  });

  // Process scheduled jobs
  cron.schedule('* * * * *', () => {
    const now = new Date().toISOString();
    const jobs = db.prepare("SELECT * FROM jobs WHERE status = 'pending' AND scheduled_at <= ?").all(now) as any[];

    for (const job of jobs) {
      try {
        // In a real implementation, this would execute the scheduled job
        // For now, we'll just mark it as processed
        db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").run(job.id);
        console.log(`Processed job ${job.id}`);
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);
        db.prepare("UPDATE jobs SET status = 'failed' WHERE id = ?").run(job.id);
      }
    }
  });

  // Agent-based cron tasks (reasoning loop driven)
  startCronTasks();

  console.log('Cron scheduler started');
}
