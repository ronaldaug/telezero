# Skills System

TeleZero's skills system allows dynamic, hot-reloadable capability extensions. Each skill is a self-contained module that the agent can discover and use without requiring a restart.

## Overview

Skills are the primary way to extend the agent's capabilities. They live in `src/skills/` and are automatically discovered at startup and during runtime via file watching.

```
├── SOUL.md              # Master skills guide (injected into LLM context)
src/skills/
├── email/
│   ├── index.ts          # Tool definition + handler
│   ├── schema.ts         # Zod input validation
│   └── SOUL.md          # Skill-specific LLM instructions
├── weather/
│   ├── index.ts
│   └── SOUL.md
├── reminder/
│   ├── index.ts
│   └── SOUL.md
└── template/             # Boilerplate for new skills
    ├── index.ts
    ├── schema.ts
    └── SOUL.md
```

## Skill Structure

Each skill is a directory containing:

### `index.ts` — Tool Definition and Handler

The main entry point. Exports the tool definition, schema, and execution function.

```typescript
import { z } from 'zod';

export const toolDef = {
  name: 'send_email',
  description: 'Send an email to a recipient',
};

export const schema = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
});

export async function execute(args: z.infer<typeof schema>) {
  // Validate input
  const validated = schema.parse(args);
  
  // Execute the skill logic
  const result = await sendEmail(validated);
  
  return {
    success: true,
    result,
  };
}
```

### `schema.ts` — Input Validation (Optional)

Zod schema for validating tool inputs. Can be inlined in `index.ts` or separated for complex schemas.

```typescript
import { z } from 'zod';

export const ReminderSchema = z.object({
  time: z.string(),
  message: z.string(),
  repeat: z.enum(['none', 'daily', 'weekly']).optional(),
});
```

### `SOUL.md` — LLM Instructions

Markdown file containing skill-specific instructions for the LLM. This content is injected into the agent's context so the LLM knows when and how to use the skill.

```markdown
# Email Skill

Use this skill to send emails via SMTP.

## When to use
- User asks to send an email
- User asks to notify someone via email

## Parameters
- to: recipient email address
- subject: email subject line
- body: email body text

## Example
User: "Send an email to alice@example.com saying the meeting is at 3pm"
Action: send_email
Input: { "to": "alice@example.com", "subject": "Meeting Update", "body": "The meeting is at 3pm" }
```

## Skill Lifecycle

### 1. Discovery

At startup, the system scans `src/skills/` for directories containing an `index.ts` file. Each discovered skill is registered with the agent.

### 2. Registration

The skill's `toolDef` (name and description) is added to the available tools list in the reasoning loop prompt. The `SOUL.md` content is appended to the LLM context.

### 3. Execution

When the LLM decides to use a skill:
1. The reasoning loop matches the action name to a registered skill
2. The skill's `schema` validates the input arguments
3. The `execute` function runs with validated arguments
4. The result is returned to the reasoning loop

### 4. Hot-Reload

`chokidar` watches the `src/skills/` directory for changes:
- **New directory** → Discover and register the new skill
- **File change** → Rebuild the affected skill
- **Directory removal** → Unregister the skill

No restart is required.

## Creating a New Skill

### Step 1: Create the Directory

```bash
mkdir src/skills/my_skill
```

### Step 2: Create `index.ts`

```typescript
import { z } from 'zod';

export const toolDef = {
  name: 'my_skill',
  description: 'Description of what this skill does',
};

export const schema = z.object({
  input: z.string(),
});

export async function execute(args: z.infer<typeof schema>) {
  const validated = schema.parse(args);
  
  // Your skill logic here
  const result = `Processed: ${validated.input}`;
  
  return {
    success: true,
    result,
  };
}
```

### Step 3: Create `SOUL.md`

```markdown
# My Skill

Describe when and how the LLM should use this skill.

## When to use
- Condition 1
- Condition 2

## Parameters
- input: description of the parameter
```

### Step 4: That's It

The file watcher will automatically detect the new skill. The next agent interaction can use it.

## Built-in Skills

### Email

Sends emails via SMTP using `nodemailer`.

**Tools**: `send_email`
**Config**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in `.env`

### Weather

Fetches weather information for a location.

**Tools**: `get_weather`

### Reminder

Creates and manages reminders.

**Tools**: `create_reminder`, `list_reminders`, `delete_reminder`

## Best Practices

1. **Validate inputs** — Always use Zod schemas to validate arguments before execution
2. **Handle errors gracefully** — Return structured error results, don't throw
3. **Write clear SOUL.md** — The LLM can only use the skill if it understands when to use it
4. **Keep skills focused** — Each skill should do one thing well
5. **Log execution** — Record skill execution results to the database for debugging
6. **Use the template** — Copy `src/skills/template/` as a starting point for new skills

## Next Steps

- [Agent System](./agent-system.md) — How skills integrate with the reasoning loop
- [Database](./database.md) — How skill results are persisted
- [Development Guide](./development.md) — Testing skills