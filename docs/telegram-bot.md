# Telegram Bot

TeleZero uses GramIO (`gramio.dev`) as its Telegram interface, providing fast MTProto-based communication with the Telegram API.

## Overview

The Telegram layer handles:
- **Message reception** — Receiving and parsing user messages
- **Session management** — Loading user context from the database
- **Response delivery** — Sending agent responses back to Telegram
- **Error handling** — Graceful error reporting to users

## Files

### `src/telegram/bot.ts`

Initializes the GramIO bot and registers message handlers.

```typescript
import { Bot } from 'gramio';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  
  // Forward to agent controller
  const response = await agentController.runTask({ userId, message: text });
  
  // Send response back
  await ctx.reply(response);
});

bot.start();
```

### `src/telegram/middleware.ts`

Provides session loading and message enrichment.

```typescript
async function loadSession(chatId: string) {
  const session = database.getSession(chatId);
  if (!session) {
    return database.createSession(chatId);
  }
  return session;
}

async function handleMessage(ctx, next) {
  const session = await loadSession(ctx.chat.id);
  ctx.session = session;
  return next();
}
```

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |

## Message Flow

```
1. User sends message on Telegram
2. Telegram servers push update via MTProto
3. GramIO receives the update
4. 'message:text' handler fires
5. Middleware loads session from database
6. Agent controller processes the message
7. Response is sent via ctx.reply()
```

## Supported Message Types

Currently, the bot handles:
- **Text messages** — Primary interaction method
- **Commands** — `/start`, `/help`, `/status`, etc.

Additional types (photos, documents, voice) can be added by registering new handlers.

## Bot Commands

Register these commands with @BotFather:

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot and session |
| `/help` | Show available commands |
| `/status` | Show current agent status |
| `/jobs` | List scheduled jobs |
| `/clear` | Clear conversation history |

## Error Handling

The bot catches errors and sends user-friendly messages:

```typescript
try {
  const response = await agentController.runTask({ userId, message: text });
  await ctx.reply(response);
} catch (error) {
  logger.error('Agent error:', error);
  await ctx.reply('⚠️ An error occurred while processing your request.');
}
```

## Rate Limiting

Telegram has API rate limits (approximately 30 messages/second per bot). The bot should:
- Queue responses if needed
- Handle `429 Too Many Requests` errors with retry logic

## Security Considerations

- **Token protection** — Never commit the bot token to version control
- **User validation** — Optionally restrict access to specific user IDs
- **Input sanitization** — Validate and sanitize all incoming messages

## Testing

Test the bot locally:

```bash
pnpm run dev
```

Send messages to your bot on Telegram and observe the console output for debugging.

## Next Steps

- [Agent System](./agent-system.md) — How messages become tasks
- [Getting Started](./getting-started.md) — Initial bot setup with @BotFather
