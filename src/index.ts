import 'dotenv/config';
import { migrate } from './database/index.js';
import { startBot } from './telegram/bot.js';
import { startScheduler } from './cron/scheduler.js';

async function main() {
    console.log('🚀 Starting TeleZero agent...');
    console.log('');

    // Initialize database
    migrate();

    // Start services
    await startBot();  // Telegram bot
    startScheduler();  // Cron jobs

    console.log('');
    console.log('✅ Main app running (Telegram bot + agent + cron)');
}

main().catch(error => {
    console.error('Failed to start:', error);
    process.exit(1);
});
