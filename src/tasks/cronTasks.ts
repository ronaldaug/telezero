import cron from 'node-cron';
import { runTask } from '../agent/agentController.js';

export function startCronTasks() {
  // Example: every hour, summarize logs in a directory using the agent.
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Agent Cron] Running hourly log summary task...');
      const result = await runTask({
        source: 'cron',
        message: 'Summarize the most important information from the latest log files in the ./logs directory.',
      });
      console.log('[Agent Cron] Hourly log summary result:', result);
    } catch (error) {
      console.error('[Agent Cron] Failed to run hourly log summary task:', error);
    }
  });

  console.log('Agent cron tasks scheduled.');
}

