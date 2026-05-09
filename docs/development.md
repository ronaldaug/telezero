# Development Guide

This guide covers coding standards, testing practices, and contribution guidelines for TeleZero.

## Coding Standards

### Language and Style

- **TypeScript** — All source code is written in TypeScript
- **ES Modules** — Use `import`/`export` syntax (project has `"type": "module"`)
- **Async/Await** — Use `async/await` for asynchronous operations, avoid raw promises
- **Modern Node.js** — Target Node.js 20+ features

### File Organization

```
src/
├── module/
│   ├── index.ts          # Module entry point
│   ├── feature.ts        # Feature implementation
│   └── types.ts          # Module-specific types
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | `camelCase.ts` or `kebab-case.ts` | `agentController.ts`, `reasoning-loop.ts` |
| Functions | `camelCase` | `runTask()`, `getSession()` |
| Classes | `PascalCase` | `AgentTask`, `SkillLoader` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_STEPS`, `DATABASE_URL` |
| Types/Interfaces | `PascalCase` | `Session`, `JobResult` |

### Code Comments

- Use comments to explain **why**, not **what**
- Add JSDoc for public APIs:

```typescript
/**
 * Creates or retrieves a user session.
 * @param chatId - The Telegram chat ID
 * @returns The session object
 */
function getSession(chatId: string): Session {
  // ...
}
```

### Error Handling

- Use structured error results, don't throw across module boundaries
- Log errors with context:

```typescript
logger.error('Failed to send email', { to, error });
return { success: false, error: 'Email delivery failed' };
```

## Tools

### Core Tools (`src/tools/`)

Core tools provide fundamental system capabilities:

#### Filesystem Tool

```typescript
// src/tools/filesystem.js
export async function writeFile(path, content) {
  // Implementation
}

export async function readFile(path) {
  // Implementation
}

export async function listDirectory(path) {
  // Implementation
}
```

#### Shell Tool

```typescript
// src/tools/shell.js
export async function runCommand(command) {
  // Implementation
}
```

### Creating New Tools

1. Create the tool file in `src/tools/`
2. Export named functions with clear input/output contracts
3. Return structured results:

```typescript
{
  success: boolean,
  result?: any,
  error?: string
}
```

## Testing

### Running Tests

```bash
pnpm run test
```

### Test Structure

Tests live in `tests/` alongside or separate from source:

```
tests/
├── agent.test.ts
├── skills.test.ts
├── telegram.test.ts
└── database.test.ts
```

### Writing Tests

Use Jest for unit and integration tests:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { agentController } from '../src/agent/agentController';

describe('AgentController', () => {
  beforeEach(() => {
    // Setup
  });

  it('should create a task from a message', async () => {
    const result = await agentController.runTask({
      userId: '123',
      message: 'hello',
    });
    expect(result).toBeDefined();
  });
});
```

### Testing Skills

```typescript
describe('Email Skill', () => {
  it('should validate email input', () => {
    expect(() => schema.parse({ to: 'invalid' })).toThrow();
  });

  it('should send email successfully', async () => {
    const result = await execute({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello',
    });
    expect(result.success).toBe(true);
  });
});
```

### Testing Database

Use an in-memory or temporary database for tests:

```typescript
import { Database } from 'better-sqlite3';

let db: Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(schemaSQL);
});

afterEach(() => {
  db.close();
});
```

## Build Process

### Development

```bash
pnpm run dev
```

Uses `tsx` for on-the-fly TypeScript compilation with file watching.

### Production Build

```bash
pnpm run build
```

Compiles TypeScript to JavaScript in the `dist/` directory.

### Database Migration

```bash
pnpm run db:migrate
```

Runs pending database migrations.

## Git Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring

### Commit Messages

Follow conventional commits:

```
feat: add weather skill
fix: handle session not found error
docs: update architecture diagram
refactor: extract prompt builder from reasoning loop
```

## Project Structure Reference

```
telezero/
├── src/                    # Source code
│   ├── index.ts            # Main entry point
│   ├── agent/              # Agent controller & reasoning loop
│   ├── telegram/           # Telegram bot integration
│   ├── llm/                # LLM client wrapper
│   ├── tools/              # Core tools
│   ├── skills/             # Dynamic skill modules
│   ├── database/           # SQLite layer
│   ├── cron/               # Scheduled tasks
│   ├── dashboard/          # Web monitoring
│   ├── tasks/              # Cron task definitions
│   ├── types/              # TypeScript types
│   └── workspace/          # Agent workspace
├── cronjobs/               # System crontab scripts
├── scripts/                # Build & utility scripts
├── ecosystem/              # Docker & infrastructure
├── public/                 # Static assets (dashboard)
├── data/                   # SQLite database files
├── logs/                   # Application logs
├── tests/                  # Test files
├── docs/                   # Documentation
├── dist/                   # Compiled output (after build)
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Environment template
└── pm2.config.js           # PM2 process configuration
```

## Next Steps

- [Deployment](./deployment.md) — Production deployment strategies
- [Architecture](./architecture.md) — System design reference
