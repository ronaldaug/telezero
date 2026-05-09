/**
 * Run one agent task from the CLI and print logs + result.
 * Usage: npx tsx scripts/run-agent-task.ts "Your message here"
 * Example: npx tsx scripts/run-agent-task.ts "Write hello world to my Notion page"
 */
import 'dotenv/config';
import { runTask } from '../src/agent/agentController.js';

const message = process.argv[2] || 'List files in the current directory.';
console.log('Message:', message);
console.log('---');

runTask({ message, source: 'system' })
  .then((answer) => {
    console.log('---');
    console.log('Answer:', answer);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
