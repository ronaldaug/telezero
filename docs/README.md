# TeleZero Documentation

Welcome to the TeleZero documentation. TeleZero is a production-ready, OpenClaw-like autonomous agent system built with Node.js and TypeScript.

## Release Source

- GitHub repository: [https://github.com/ronaldaug/telezero.git](https://github.com/ronaldaug/telezero.git)

## Overview

TeleZero is an intelligent agent that connects to Telegram and uses LLM-powered reasoning to perform multi-step tasks autonomously. It features a dynamic skills system, persistent sessions, scheduled jobs, and a web-based monitoring dashboard.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Getting Started](./getting-started.md) | Installation, setup, and first run |
| [Architecture](./architecture.md) | System design, components, and data flow |
| [Agent System](./agent-system.md) | Agent controller, tasks, and reasoning loop |
| [Skills System](./skills-system.md) | Dynamic skills, tool creation, and hot-reload |
| [Database](./database.md) | SQLite schema, sessions, and job management |
| [Telegram Bot](./telegram-bot.md) | Telegram integration and message handling |
| [LLM Integration](./llm-integration.md) | LLM client configuration and prompt templates |
| [Cron Jobs](./cron-jobs.md) | Scheduled tasks and background processing |
| [Dashboard](./dashboard.md) | Web monitoring and management interface |
| [Development Guide](./development.md) | Coding standards, testing, and contribution |
| [Deployment](./deployment.md) | Production setup, PM2, and Docker |

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
pnpm run db:migrate

# Start in development mode
pnpm run dev
```

## Key Features

- **Telegram Interface** — Natural language interaction via Telegram bot
- **Autonomous Agent** — Multi-step reasoning with tool execution
- **Dynamic Skills** — Hot-reloadable skill modules
- **Persistent Sessions** — SQLite-backed session management
- **Scheduled Jobs** — Cron-based task scheduling
- **Web Dashboard** — Real-time monitoring and management
- **Simple Auth Login** — Lightweight authentication now protects dashboard access

## Landing Page Notes

- Landing page is release-ready and no longer uses waitlist messaging.
- Primary CTA points directly to the GitHub source repository.
- Feature highlights include the new simple dashboard login/auth coverage.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ with TypeScript |
| Telegram | GramIO (`gramio.dev`) |
| LLM | OpenAI-compatible API (OpenAI, Qwen, etc.) |
| Database | `better-sqlite3` |
| Validation | `zod` |
| Cron | `node-cron` |
| Process Mgmt | PM2 |
| Dashboard | Express.js |
| File Watch | `chokidar` |

## Project Structure

```
telezero/
├── src/
│   ├── index.ts              # Main entry point
│   ├── agent/                # Agent controller & reasoning loop
│   ├── telegram/             # Telegram bot integration
│   ├── llm/                  # LLM client wrapper
│   ├── tools/                # Core tools (filesystem, shell)
│   ├── skills/               # Dynamic skill modules
│   ├── database/             # SQLite connection & migrations
│   ├── cron/                 # Scheduled task scheduler
│   ├── dashboard/            # Web monitoring server
│   ├── tasks/                # Cron task definitions
│   ├── types/                # TypeScript type definitions
│   └── workspace/            # Agent workspace files
├── cronjobs/                 # System crontab scripts
├── scripts/                  # Build & utility scripts
├── ecosystem/                # Docker & infrastructure
├── public/                   # Static assets
├── data/                     # SQLite database files
└── docs/                     # This documentation
```

## Architecture Flow

```
User → Telegram → GramIO Bot
                  ↓
          Agent Controller
                  ↓
            Agent Task
                  ↓
         Reasoning Loop (LLM)
                  ↓
        ┌─────────┴─────────┐
        ↓                   ↓
    Core Tools          Dynamic Skills
  (fs, shell)        (email, weather, etc.)
        ↓                   ↓
         └────────┬────────┘
                  ↓
          SQLite (sessions + jobs)
                  ↓
          Response → Telegram
```

## License

MIT
