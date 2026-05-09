import { Bot } from 'gramio';
import { sessionMiddleware } from './middleware.js';
import { runTask } from '../agent/agentController.js';
import { saveMessage, getRecentMessages } from '../database/index.js';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '');
let pollingActive = false;

bot.use(sessionMiddleware);

bot.command('start', (context) => {
  return context.send('Welcome to TeleZero! I am your AI agent.');
});

bot.on('message', async (context) => {
  if (!context.text) return;

  const typingIntervalMs = 4000;
  let typingInterval: ReturnType<typeof setInterval> | undefined;

  const startTyping = async () => {
    try {
      await context.sendChatAction('typing');
    } catch (error) {
      console.warn('Failed to send typing action:', error);
    }
  };

  await startTyping();
  typingInterval = setInterval(() => {
    void startTyping();
  }, typingIntervalMs);

  const chatId = context.chatId;

  try {
    const userId = context.from?.id;

    // Save the user's message to the database
    if (chatId) {
      saveMessage(chatId, 'user', context.text);
    }

    // Load conversation history from the database
    const recentMessages = chatId
      ? getRecentMessages(chatId, 50).map((m) => ({ role: m.role, content: m.content }))
      : [];

    const answer = await runTask({
      userId,
      message: context.text,
      source: 'telegram',
      conversationHistory: recentMessages,
    });

    const reply = answer || 'No response received.';

    // Save the assistant's response to the database
    if (chatId) {
      saveMessage(chatId, 'assistant', reply);
    }

    return context.send(reply);
  } catch (error: any) {
    console.error('Error in agent task:', error);
    return context.send('Sorry, there was an internal error while handling your request. Error: ' + error.message);
  } finally {
    if (typingInterval) {
      clearInterval(typingInterval);
    }
  }
});

export async function startBot() {
  console.log('Starting Telegram bot...');
  try {
    // Clear any previous webhook to ensure polling starts receiving updates instantly
    await bot.api.deleteWebhook();
    console.log('  - Webhook cleared, starting polling...');
  } catch (error) {
    console.warn('  - Non-critical: Could not delete webhook (it might already be empty).');
  }
  // Start the bot with dropping pending updates to avoid stale messages
  await bot.start({ dropPendingUpdates: true });
  pollingActive = true;
}

export async function stopBot() {
  // GramIO internals can differ by version; probe both common stop entrypoints.
  const maybeUpdates = (bot as any).updates;
  if (maybeUpdates?.stop && typeof maybeUpdates.stop === 'function') {
    await maybeUpdates.stop();
    pollingActive = false;
    return;
  }
  if ((bot as any).stop && typeof (bot as any).stop === 'function') {
    await (bot as any).stop();
    pollingActive = false;
    return;
  }
  throw new Error('Current GramIO version does not expose a stop method for polling');
}

export function isBotPollingActive(): boolean {
  return pollingActive;
}

export async function getTelegramWebhookInfo() {
  return bot.api.getWebhookInfo();
}

export async function clearTelegramWebhook(dropPendingUpdates: boolean = true) {
  await bot.api.deleteWebhook({ drop_pending_updates: dropPendingUpdates });
}
