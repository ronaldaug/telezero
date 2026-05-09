# Database

TeleZero uses SQLite via `better-sqlite3` for persistent storage of sessions and job queue data.

## Overview

The database layer provides:
- **Session persistence** — User context survives restarts
- **Job queue** — Scheduled tasks are stored and tracked
- **Zero external dependencies** — No database server required

## Configuration

The database path is configured via the `DATABASE_URL` environment variable:

```env
DATABASE_URL=data/telezero.db
```

The database file is created automatically on first access.

## Schema

### Sessions Table

Stores user session context, including conversation history and state.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    chat_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    context_json TEXT DEFAULT '{}',
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `chat_id` | TEXT | Primary key — Telegram chat ID |
| `user_id` | INTEGER | Telegram user ID |
| `context_json` | TEXT | JSON-serialized session context (conversation history, preferences, etc.) |
| `last_active` | DATETIME | Timestamp of last interaction |
| `created_at` | DATETIME | Session creation timestamp |

### Jobs Table

Stores scheduled and executed background jobs.

```sql
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    skill_name TEXT NOT NULL,
    args_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    scheduled_at DATETIME,
    result_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `chat_id` | TEXT | Associated Telegram chat (nullable for system jobs) |
| `skill_name` | TEXT | Name of the skill that handles this job |
| `args_json` | TEXT | JSON-serialized job arguments |
| `status` | TEXT | Job status: `pending`, `running`, `completed`, `failed` |
| `scheduled_at` | DATETIME | When the job should execute |
| `result_json` | TEXT | JSON-serialized execution result |
| `created_at` | DATETIME | Job creation timestamp |

## Database Module

**File**: `src/database/index.ts`

The database module provides a clean API for session and job management.

### Session Operations

```typescript
// Get or create a session
function getSession(chatId: string): Session;

// Update session context
function updateSession(chatId: string, context: object): void;

// Delete a session
function deleteSession(chatId: string): void;

// Get all active sessions
function getActiveSessions(sinceMinutes: number): Session[];
```

### Job Operations

```typescript
// Create a new job
function createJob(job: {
  chatId?: string;
  skillName: string;
  args: object;
  scheduledAt?: Date;
}): Job;

// Get pending jobs
function getPendingJobs(): Job[];

// Update job status
function updateJobStatus(jobId: number, status: string, result?: object): void;

// Get jobs for a chat
function getJobsForChat(chatId: string): Job[];
```

## Migrations

**Directory**: `src/database/migrations/`

Database migrations are versioned SQL scripts that modify the schema. They are run via:

```bash
pnpm run db:migrate
```

### Migration Pattern

Each migration file follows the naming convention:

```
001_create_sessions.sql
002_create_jobs.sql
003_add_index_on_scheduled_at.sql
```

Migrations are executed in order by filename. A `schema_migrations` table tracks which migrations have been applied.

## Data Flow

### Session Lifecycle

```
1. User sends first message
2. getSession() creates a new session row
3. Each interaction updates context_json and last_active
4. Inactive sessions can be cleaned up periodically
```

### Job Lifecycle

```
1. Cron scheduler or user action creates a job (status: pending)
2. Scheduler picks up pending jobs (status: running)
3. Skill executes the job logic
4. Result is stored (status: completed or failed)
```

## Backup

The database file can be backed up with a simple file copy:

```bash
cp data/telezero.db data/telezero.db.backup.$(date +%Y%m%d)
```

A cron job in `cronjobs/backup-db.sh` can automate this.

## Performance Considerations

- **Synchronous access** — `better-sqlite3` is synchronous, which is fine for a single-process agent
- **Indexes** — Add indexes on frequently queried columns (e.g., `status` on jobs, `last_active` on sessions)
- **WAL mode** — Enable Write-Ahead Logging for better concurrent read performance:

```sql
PRAGMA journal_mode = WAL;
```

## Troubleshooting

### Database is locked
- Ensure only one process is accessing the database
- Check for unclosed connections

### Corrupted database
- Restore from backup
- The database file can be deleted and recreated with `pnpm run db:migrate`

### Migration errors
- Check that migrations are idempotent (use `CREATE TABLE IF NOT EXISTS`)
- Verify migration order

## Next Steps

- [Cron Jobs](./cron-jobs.md) — How jobs are scheduled and executed
- [Development Guide](./development.md) — Testing database interactions
