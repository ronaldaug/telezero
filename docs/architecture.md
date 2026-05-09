# Architecture

This document describes the system architecture of TeleZero, including component relationships and data flow.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Telegram Cloud                   │
└──────────────────────┬──────────────────────────────┘
                       │ MTProto
                       ↓
┌─────────────────────────────────────────────────────┐
│                  GramIO Bot Layer                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  telegram/bot.ts — Message receiver         │    │
│  │  telegram/middleware.ts — Session & routing │    │
│  └─────────────────────┬───────────────────────┘    │
└────────────────────────┼────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Agent Controller                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  agent/agentController.js — Task orchestration   │
│  │  agent/agentTask.js — Task state management │    │
│  └─────────────────────┬───────────────────────┘    │
└────────────────────────┼────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Reasoning Loop                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  agent/reasoningLoop.js — Core agent loop   │    │
│  │  llm/llmClient.js — LLM API communication   │    │
│  └─────────────────────┬───────────────────────┘    │
└────────────────────────┼────────────────────────────┘
                         ↓
         ┌───────────────┴───────────────┐
         ↓                               ↓
┌─────────────────-─┐         ┌──────────────────┐
│   Core Tools      │         │  Dynamic Skills  │
│ ┌──────────────-┐ │         │ ┌──────────────┐ │
│ │ filesystem.js │ │         │ │  email/      │ │
│ │ shell.js      │ │         │ │  weather/    │ │
│ └─────────────-─┘ │         │ │  reminder/   │ │
└────────┬────────-─┘         │ └──────────────┘ │
         │                    └────────┬─────────┘
         ↓                             ↓
┌─────────────────────────────────────────────────────┐
│                  Data Persistence                   │
│  ┌─────────────────────────────────────────────┐    │
│  │  database/index.ts — SQLite connection      │    │
│  │  database/schema.sql — Table definitions    │    │
│  │  database/migrations/ — Schema versioning   │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Component Overview

### 1. Telegram Layer (`src/telegram/`)

**Responsibility**: Receive messages from Telegram users and forward them to the agent system.

- **`bot.ts`** — Initializes the GramIO bot, registers message handlers, and sends responses back to Telegram
- **`middleware.ts`** — Loads user sessions from the database, enriches messages with context, and routes to the agent controller

### 2. Agent Controller (`src/agent/`)

**Responsibility**: Orchestrate task creation, execution, and response delivery.

- **`agentController.js`** — Main entry point for agent execution. Receives user messages, creates agent tasks, starts the reasoning loop, and returns final responses
- **`agentTask.js`** — Defines the task data structure including ID, user ID, objective, execution history, steps, and status

### 3. Reasoning Loop (`src/agent/`)

**Responsibility**: The core autonomous agent loop that enables multi-step reasoning.

- **`reasoningLoop.js`** — Implements the iterative reasoning loop:
  1. Builds a prompt with the objective, previous steps, and tool results
  2. Sends the prompt to the LLM
  3. Parses the structured JSON response (thought, action, input, done)
  4. Executes the selected tool if an action is specified
  5. Appends the result to the history
  6. Repeats until `done: true` or max steps reached (default: 5)

### 4. LLM Client (`src/llm/`)

**Responsibility**: Abstract LLM API communication.

- **`llmClient.js`** — Wraps the LLM API (OpenAI-compatible) and exposes `generateAgentStep(context)` for the reasoning loop. Handles prompt construction, API calls, and response parsing.

### 5. Core Tools (`src/tools/`)

**Responsibility**: Provide fundamental system capabilities to the agent.

- **`filesystem.js`** — File operations: `writeFile`, `readFile`, `listDirectory`
- **`shell.js`** — Command execution: `runCommand(command)`

All tools return structured results with status, output, and error information.

### 6. Dynamic Skills (`src/skills/`)

**Responsibility**: Extend agent capabilities with hot-reloadable modules.

Each skill is a self-contained directory with:
- `index.ts` — Tool definition and execution handler
- `schema.ts` — Zod validation schema for inputs
- `SOUL.md` — Skill instructions for the LLM

Skills are discovered automatically via `chokidar` file watching and registered with the agent at runtime.

### 7. Database (`src/database/`)

**Responsibility**: Persistent storage for sessions and job queue.

- **`index.ts`** — SQLite connection management, session CRUD operations, job queue operations
- **`schema.sql`** — Table definitions for `sessions` and `jobs`
- **`migrations/`** — Versioned schema updates

### 8. Cron Scheduler (`src/cron/`)

**Responsibility**: Execute scheduled background tasks.

- **`scheduler.ts`** — Uses `node-cron` to trigger periodic agent tasks
- **`jobs/`** — Task definitions (e.g., daily digest, cleanup)

### 9. Dashboard (`src/dashboard/`)

**Responsibility**: Web-based monitoring and management interface.

- **`server.ts`** — Express server serving HTML and REST API
- **`real-server.ts`** — Enhanced server with real system integration

## Data Flow

### User Message Flow

```
1. User sends message on Telegram
2. GramIO receives the update via MTProto
3. Middleware loads session from SQLite (chat_id → context)
4. AgentController creates an AgentTask with the message as objective
5. ReasoningLoop begins iteration:
   a. LLM receives prompt with objective + history
   b. LLM returns JSON with next action or completion
   c. If action: execute tool, record result, repeat
   d. If done: return final_answer
6. Response sent back to Telegram user
7. Session updated in SQLite with new context
```

### Skill Hot-Reload Flow

```
1. Developer creates new skill directory under src/skills/
2. chokidar detects the new directory
3. Skill loader scans the directory for index.ts and SOUL.md
4. New tool is registered with the agent system
5. Next agent interaction can use the new skill
```

### Cron Job Flow

```
1. node-cron triggers scheduled callback
2. Scheduler creates an AgentTask with the job objective
3. ReasoningLoop executes the task (same as user message flow)
4. Results are logged to the jobs table in SQLite
```

## Database Schema

### Sessions Table

| Column | Type | Description |
|--------|------|-------------|
| `chat_id` | TEXT (PK) | Telegram chat identifier |
| `user_id` | INTEGER | Telegram user ID |
| `context_json` | TEXT | Serialized session context |
| `last_active` | DATETIME | Last interaction timestamp |
| `created_at` | DATETIME | Session creation timestamp |

### Jobs Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER (PK) | Unique job identifier |
| `chat_id` | TEXT | Associated chat (nullable) |
| `skill_name` | TEXT | Skill that handles this job |
| `args_json` | TEXT | Serialized job arguments |
| `status` | TEXT | pending / running / completed / failed |
| `scheduled_at` | DATETIME | When the job should run |
| `result_json` | TEXT | Serialized execution result |
| `created_at` | DATETIME | Job creation timestamp |

## Design Decisions

### Why No MCP?

TeleZero uses a direct agent reasoning loop instead of the Model Context Protocol. The LLM communicates directly with the agent controller, which manages tool execution. This simplifies the architecture and reduces latency by eliminating the stdio pipe layer.

### Why SQLite?

`better-sqlite3` provides synchronous, zero-dependency database access with no external service requirements. It's ideal for a single-process agent system that needs persistent storage without operational complexity.

### Why 5 Max Steps?

The reasoning loop defaults to 5 iterations to balance capability with safety. This allows multi-step tasks while preventing runaway execution. The limit is configurable per task.

## Next Steps

- [Agent System](./agent-system.md) — Deep dive into the agent architecture
- [Skills System](./skills-system.md) — How to create and manage skills
- [Development Guide](./development.md) — Coding standards and testing
