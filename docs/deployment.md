# Deployment

This guide covers deploying TeleZero to production, including process management with PM2 and containerization with Docker.

## Production Build

Before deploying, compile the project:

```bash
pnpm run build
```

This outputs compiled JavaScript to the `dist/` directory.

## PM2 Deployment

PM2 is the recommended process manager for production.

### Configuration

**File**: `pm2.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'telezero',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'telezero-dashboard',
      script: 'dist/dashboard/server.js',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
```

### Starting with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start all processes
pm2 start pm2.config.js

# Monitor
pm2 monit

# View logs
pm2 logs telezero

# Save process list (auto-restart on reboot)
pm2 save
pm2 startup
```

### PM2 Commands

| Command | Description |
|---------|-------------|
| `pm2 start pm2.config.js` | Start all applications |
| `pm2 stop all` | Stop all applications |
| `pm2 restart telezero` | Restart a specific app |
| `pm2 reload telezero` | Zero-downtime reload |
| `pm2 logs` | View all logs |
| `pm2 monit` | Real-time monitoring |

## Docker Deployment

### Dockerfile

**File**: `ecosystem/Dockerfile.prod`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM node:20-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/schema.sql ./dist/database/schema.sql

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose

**File**: `ecosystem/docker-compose.yml`

```yaml
version: '3.8'

services:
  telezero:
    build:
      context: ..
      dockerfile: ecosystem/Dockerfile.prod
    ports:
      - "3000:3000"
    volumes:
      - telezero-data:/app/data
      - telezero-logs:/app/logs
    env_file:
      - .env
    restart: unless-stopped

  dashboard:
    build:
      context: ..
      dockerfile: ecosystem/Dockerfile.prod
    command: ["node", "dist/dashboard/server.js"]
    ports:
      - "3001:3000"
    depends_on:
      - telezero
    restart: unless-stopped

volumes:
  telezero-data:
  telezero-logs:
```

### Running with Docker

```bash
cd ecosystem
docker-compose up -d
```

## Environment Variables

Ensure all required environment variables are set in production:

```env
TELEGRAM_BOT_TOKEN=your_production_bot_token
DATABASE_URL=data/telezero.db
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## System Crontab

Install system-level cron jobs for maintenance tasks:

```bash
# Database backup daily at 2 AM
0 2 * * * /path/to/telezero/cronjobs/backup-db.sh

# Log rotation weekly
0 0 * * 0 /usr/sbin/logrotate /path/to/telezero/logrotate.conf
```

## Log Management

### Log Locations

| Log | Path |
|-----|------|
| Application | `logs/out.log` |
| Errors | `logs/error.log` |
| PM2 | `~/.pm2/logs/` |

### Log Rotation

Configure logrotate to prevent unbounded log growth:

```
/path/to/telezero/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
```

## Health Checks

Monitor the application health:

```bash
# Check if the process is running
pm2 list

# Check API health
curl http://localhost:3000/api/status

# Check database connectivity
sqlite3 data/telezero.db "SELECT count(*) FROM sessions;"
```

## Security Checklist

- [ ] Environment variables are not committed to git
- [ ] `.env` file has restricted permissions (`chmod 600 .env`)
- [ ] Telegram bot token is restricted to specific user IDs if needed
- [ ] Dashboard is not publicly accessible without authentication
- [ ] Database file is included in backups
- [ ] Logs don't contain sensitive information
- [ ] Node.js and dependencies are up to date

## Backup Strategy

### Database

```bash
#!/bin/bash
# cronjobs/backup-db.sh
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
cp /path/to/telezero/data/telezero.db "$BACKUP_DIR/telezero.$DATE.db"
# Keep only last 30 days
find "$BACKUP_DIR" -name "telezero.*.db" -mtime +30 -delete
```

### Code

The codebase is in git. Ensure the repository is pushed to a remote regularly.

## Monitoring

- **PM2 Monit** — Real-time CPU and memory monitoring
- **Dashboard** — Web-based status monitoring at `http://localhost:3000`
- **Logs** — Application and error logs in `logs/`

## Rollback

If a deployment causes issues:

```bash
# With PM2
pm2 restart telezero --update-env

# With Docker
docker-compose down
docker-compose up -d

# Revert code
git revert HEAD
pnpm run build
pm2 restart telezero
```

## Next Steps

- [Dashboard](./dashboard.md) — Monitoring the production system
- [Development Guide](./development.md) — Making changes safely
