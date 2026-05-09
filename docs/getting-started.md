# Getting Started

This guide walks you through installing, configuring, and running TeleZero for the first time.

## Prerequisites

- **Node.js 20+** — TeleZero requires a modern Node.js runtime
- **pnpm** (recommended) or npm — Package manager
- **Telegram Bot Token** — Obtain from [@BotFather](https://t.me/BotFather)
- **LLM API Key** — OpenAI, Qwen, or compatible provider

## Installation

### 1. Clone and Install Dependencies

```bash
cd /path/to/telezero
pnpm install
```

This installs all runtime and development dependencies including:
- `gramio` — Telegram MTProto client
- `better-sqlite3` — Embedded SQLite database
- `openai` — LLM API client
- `zod` — Schema validation
- `chokidar` — File watching for hot-reload
- `node-cron` — Task scheduling
- `express` — Dashboard web server

### 2. Configure Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Database
DATABASE_URL=data/telezero.db

# Email (optional — for email skill)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# LLM API (configure per your provider)
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
```

### 3. Initialize the Database

Run the migration script to create the SQLite schema:

```bash
pnpm run db:migrate
```

This creates the required tables:
- `sessions` — User session context
- `jobs` — Scheduled job queue

### 4. Start the Application

**Development mode** (with file watching and auto-reload):

```bash
pnpm run dev
```

This starts the Telegram bot, agent system, and cron scheduler concurrently.

**Production mode**:

```bash
pnpm run build
pnpm start
```

Or with PM2:

```bash
pm2 start pm2.config.js
```

### 5. Verify the Setup

Send a message to your Telegram bot. You should see:
1. The message received in the console logs
2. The agent processing the request
3. A response sent back to Telegram

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start all services in development mode |
| `pnpm run build` | Compile TypeScript to JavaScript |
| `pnpm start` | Run the compiled production build |
| `pnpm run launch` | Launch via shell script |
| `pnpm run test` | Run the test suite |
| `pnpm run db:migrate` | Run database migrations |
| `pnpm run agent` | Run a manual agent task |
| `pnpm run dashboard` | Start the web monitoring dashboard |

## Troubleshooting

### Bot doesn't respond
- Verify `TELEGRAM_BOT_TOKEN` is correct in `.env`
- Check that the bot is not running elsewhere (only one process can connect)
- Review logs for connection errors

### Database errors
- Ensure the `data/` directory exists and is writable
- Run `pnpm run db:migrate` if tables are missing

### LLM API errors
- Verify your API key and base URL
- Check that the model name is valid for your provider
- Ensure you have sufficient API credits

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand system design
- Explore the [Skills System](./skills-system.md) to add new capabilities
- Check the [Dashboard Guide](./dashboard.md) for monitoring setup
