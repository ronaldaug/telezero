# Cron Jobs

TeleZero supports scheduled background tasks using `node-cron` for in-process scheduling and system crontab for heavy external jobs.

## Overview

The cron system handles:
- **Periodic tasks** — Regular maintenance, digests, and monitoring
- **One-time scheduled jobs** — User-created reminders and delayed actions
- **Heavy processing** — Long-running tasks via system crontab

## Architecture

```
┌─────────────────────┐
│   node-cron         │  ← In-process scheduler
│   (src/cron/)       │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Scheduler          │  ← Job dispatcher
│  (scheduler.ts)     │
└──────────┬──────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
 In-App Jobs   System Crontab
 (src/cron/    (cronjobs/)
  jobs/)
```

## In-App Scheduler

**File**: `src/cron/scheduler.ts`

Uses `node-cron` to register periodic tasks that run within the Node.js process.

### Example

```typescript
import cron from 'node-cron';

// Daily digest at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  await runDailyDigest();
});

// Cleanup every hour
cron.schedule('0 * * * *', async () => {
  await runCleanup();
});
```

## Built-in Jobs

### Daily Digest

**File**: `src/cron/jobs/daily-digest.ts`

Runs once per day to summarize activity and send reports.

**Schedule**: `0 9 * * *` (9:00 AM daily)

**Responsibilities**:
- Query completed jobs from the database
- Summarize activity
- Send digest to configured chats

### Cleanup

**File**: `src/cron/jobs/cleanup.ts`

Runs periodically to clean up stale data.

**Schedule**: `0 * * * *` (every hour)

**Responsibilities**:
- Delete expired sessions (inactive for > 24 hours)
- Archive completed jobs older than 7 days
- Vacuum the SQLite database

## System Crontab

**Directory**: `cronjobs/`

Heavy or long-running tasks that should run as separate processes.

### Example: Database Backup

**File**: `cronjobs/backup-db.sh`

```bash
#!/bin/bash
cp /path/to/telezero/data/telezero.db /path/to/backups/telezero.$(date +%Y%m%d).db
```

Install with:
```bash
(crontab -l; echo "0 2 * * * /path/to/telezero/cronjobs/backup-db.sh") | crontab -
```

### Example: Heavy Processing

**File**: `cronjobs/heavy-processing.js`

A standalone Node.js script that processes data outside the main application.

## Job Queue Integration

The scheduler integrates with the SQLite job queue:

```
1. Scheduler queries pending jobs where scheduled_at <= NOW
2. For each pending job:
   a. Update status to "running"
   b. Load the appropriate skill
   c. Execute the skill with the job's args
   d. Update status to "completed" or "failed" with result
```

## Cron Expression Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 7, 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

### Common Patterns

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * *` | Daily at 9 AM |
| `0 0 * * 0` | Weekly on Sunday |
| `0 0 1 * *` | Monthly on the 1st |

## Creating a New Cron Job

### In-App Job

1. Create the job file in `src/cron/jobs/`:

```typescript
// src/cron/jobs/my-job.ts
export async function runMyJob() {
  // Job logic here
  console.log('Running my job');
}
```

2. Register it in `src/cron/scheduler.ts`:

```typescript
import { runMyJob } from './jobs/my-job.js';

cron.schedule('0 12 * * *', async () => {
  await runMyJob();
});
```

### System Crontab Job

1. Create the script in `cronjobs/`:

```bash
#!/bin/bash
# cronjobs/my-script.sh
echo "Running my script" >> /path/to/logs/my-script.log
```

2. Make it executable:

```bash
chmod +x cronjobs/my-script.sh
```

3. Add to crontab:

```bash
(crontab -l; echo "0 3 * * * /path/to/telezero/cronjobs/my-script.sh") | crontab -
```

## Monitoring

Cron job execution is logged to the console and to the `jobs` table in SQLite. Check job status:

```sql
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;
```

The dashboard (`pnpm run dashboard`) also displays job status information.

## Next Steps

- [Database](./database.md) — Job queue schema
- [Dashboard](./dashboard.md) — Monitoring job status
