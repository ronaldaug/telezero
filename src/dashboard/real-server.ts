import express from 'express';
import path from 'path';
import { promises as fs, existsSync } from 'node:fs';
import * as os from 'os';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { db } from '../database/index.js';
import { runTask, type ConversationMessage } from '../agent/agentController.js';
import { QwenCodeHandler } from '../services/qwen-provider.js';
import {
  clearTelegramWebhook,
  getTelegramWebhookInfo,
  isBotPollingActive,
  startBot,
  stopBot,
} from '../telegram/bot.js';
import { createRequire } from 'module';
import {
  getModelProvider,
  getModelLabel,
  getModelId,
  setModelProvider,
  ModelProvider,
  getAvailableProviders,
  getAllProvidersModels,
} from '../llm/llmClient.js';
import {
  getAgentLoopSteps,
  setAgentLoopSteps,
  AGENT_LOOP_STEPS_MIN,
  AGENT_LOOP_STEPS_MAX,
} from '../config/agentLoopSteps.js';

const require = createRequire(import.meta.url);

const app = express();
const PORT = process.env.PORT || 1337;
const serverStartTime = new Date();

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Middleware to parse JSON
app.use(express.json());
app.use(cookieParser());

const AUTH_SECRET = process.env.AUTH_SECRET || 'telezero-secret-1337';

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

function generateToken(email: string): string {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = JSON.stringify({ email, expiry });
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, signature })).toString('base64');
}

function verifyToken(token: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(decoded.payload).digest('hex');
    if (decoded.signature !== expectedSignature) return null;

    const payload = JSON.parse(decoded.payload);
    if (Date.now() > payload.expiry) return null;

    return payload.email;
  } catch {
    return null;
  }
}

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip auth for auth-related routes
  // When mounted on /api, req.path is relative to /api
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  const token = req.cookies?.tz_token;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Protect all /api routes except /api/auth/*
app.use('/api', authMiddleware);

// Shared Qwen handler for real token operations
const qwenHandler = new QwenCodeHandler();

// ── helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

function getPackageVersion(): string {
  try {
    const pkg = require(path.join(process.cwd(), 'package.json'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Read the Qwen OAuth credential file directly (no network call). */
async function readQwenCredentials(): Promise<{
  status: string;
  tokenExpiry: string | null;
  refreshToken: boolean;
  lastRefresh: string | null;
}> {
  const QWEN_DIR = '.qwen';
  const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';
  const credPath = path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);

  try {
    const raw = await fs.readFile(credPath, 'utf-8');
    const creds = JSON.parse(raw);

    const expiryDate = creds.expiry_date ? new Date(creds.expiry_date).toISOString() : null;
    const isValid = creds.expiry_date ? Date.now() < creds.expiry_date : false;

    return {
      status: isValid ? 'authenticated' : 'expired',
      tokenExpiry: expiryDate,
      refreshToken: !!creds.refresh_token,
      lastRefresh: expiryDate, // best approximation from file
    };
  } catch {
    return {
      status: 'not configured',
      tokenExpiry: null,
      refreshToken: false,
      lastRefresh: null,
    };
  }
}

function getJobCounts(): { completed: number; pending: number; failed: number } {
  try {
    const row = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
           COALESCE(SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END), 0) AS pending,
           COALESCE(SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END), 0) AS failed
         FROM jobs`,
      )
      .get() as { completed: number; pending: number; failed: number };
    return row;
  } catch {
    return { completed: 0, pending: 0, failed: 0 };
  }
}

interface ThinkingHistoryItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function extractObjectiveTitle(markdown: string, fallback: string): string {
  const lines = markdown.split(/\r?\n/);
  const line12 = lines[11] ?? '';
  const cleaned = line12
    .replace(/^\s*#+\s*/g, '')
    .replace(/^\s*objective\s*[:\-]?\s*/i, '')
    .trim();
  if (!cleaned) return fallback;
  return truncateWords(cleaned, 30);
}

async function readThinkingHistory(): Promise<ThinkingHistoryItem[]> {
  const contextDir = path.join(process.cwd(), 'src/workspace/context');
  if (!existsSync(contextDir)) return [];

  const entries = await fs.readdir(contextDir, { withFileTypes: true });
  const markdownEntries = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

  const items = await Promise.all(
    markdownEntries.map(async (entry) => {
      const filePath = path.join(contextDir, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const fallbackTitle = entry.name.replace(/\.md$/i, '');
      return {
        id: entry.name,
        title: extractObjectiveTitle(content, fallbackTitle),
        content,
        updatedAt: stats.mtime.toISOString(),
      };
    }),
  );

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ── routes ──────────────────────────────────────────────────────────────────

// Route to serve the dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// ── auth routes ─────────────────────────────────────────────────────────────

app.get('/api/auth/status', async (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const initialized = userCount.count > 0;

  const token = req.cookies?.tz_token;
  const authenticated = !!(token && verifyToken(token));

  res.json({ initialized, authenticated });
});

app.post('/api/auth/setup', async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    return res.status(400).json({ error: 'System already initialized' });
  }

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const hashed = hashPassword(password);
    db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hashed);

    const token = generateToken(email);
    res.cookie('tz_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(email);
  res.cookie('tz_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tz_token');
  res.json({ success: true });
});

// API endpoint to get status data (real data)
app.get('/api/status', async (req, res) => {
  const uptimeSeconds = process.uptime();
  const jobCounts = getJobCounts();
  const qwenAuth = await readQwenCredentials();
  const provider = await getModelProvider();
  const modelLabel = await getModelLabel();
  const modelId = (await getModelId()) ?? '';

  res.json({
    server: {
      uptime: formatUptime(uptimeSeconds),
      status: 'running',
      version: getPackageVersion(),
      lastRestart: serverStartTime.toISOString(),
    },
    agent: {
      status: jobCounts.pending > 0 ? 'busy' : 'idle',
      tasksCompleted: jobCounts.completed,
      tasksInProgress: jobCounts.pending,
      lastActive: new Date().toISOString(),
    },
    qwenAuth,
    model: {
      provider,
      label: modelLabel,
      modelId,
    },
    maxAgentLoopSteps: getAgentLoopSteps(),
    agentLoopStepsBounds: { min: AGENT_LOOP_STEPS_MIN, max: AGENT_LOOP_STEPS_MAX },
  });
});

app.post('/api/agent-loop-steps', (req, res) => {
  const raw = req.body?.maxSteps;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    res.status(400).json({ success: false, error: 'maxSteps must be a number' });
    return;
  }
  const value = setAgentLoopSteps(n);
  res.json({ success: true, maxAgentLoopSteps: value });
});

// API endpoint to get / set current model provider
app.get('/api/model-provider', async (req, res) => {
  const provider = await getModelProvider();
  const label = await getModelLabel();
  const modelId = (await getModelId()) ?? '';
  const available = await getAvailableProviders();
  const allProviders = await getAllProvidersModels();
  res.json({
    provider,
    modelId,
    label,
    available,
    allProviders,
  });
});

app.post('/api/model-provider', async (req, res) => {
  const provider = req.body?.provider as string | undefined;
  const modelId = req.body?.modelId as string | undefined;
  const availableProviders = await getAvailableProviders();
  const availableIds = availableProviders.map((p) => p.id);
  const allProviders = await getAllProvidersModels();

  if (!provider || !availableIds.includes(provider)) {
    console.warn(`[API] Invalid provider attempt: ${provider}. Available: ${availableIds.join(', ')}`);
    res.status(400).json({ success: false, error: `Invalid provider: ${provider}` });
    return;
  }

  const modelsForProvider = allProviders[provider] ?? [];
  if (!modelId || !modelsForProvider.some((m) => m.id === modelId)) {
    res.status(400).json({
      success: false,
      error: `Invalid model for provider ${provider}: ${modelId ?? '(missing)'}`,
    });
    return;
  }

  await setModelProvider(provider as ModelProvider, modelId);
  const effective = await getModelProvider();
  const label = await getModelLabel();
  const effectiveModelId = (await getModelId()) ?? '';
  res.json({ success: true, provider: effective, modelId: effectiveModelId, label });
});

// API endpoint to refresh Qwen token (real refresh)
app.post('/api/qwen-refresh', async (req, res) => {
  try {
    // Force a prompt that triggers ensureAuthenticated → refreshAccessToken
    // We use completePrompt with a tiny throwaway prompt so the handler
    // goes through the full auth cycle (load creds → refresh if expired → save).
    await qwenHandler.completePrompt('ping');

    // After the call the credential file on disk has been updated.
    const newStatus = await readQwenCredentials();
    res.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error('Qwen token refresh error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to refresh token' });
  }
});

// API endpoint to get detailed agent / job information
app.get('/api/agent-info', async (req, res) => {
  try {
    const jobs = db
      .prepare(
        `SELECT id, skill_name AS description, status, created_at AS timestamp
         FROM jobs ORDER BY created_at DESC LIMIT 20`,
      )
      .all();

    const jobCounts = getJobCounts();

    res.json({
      status: jobCounts.pending > 0 ? 'busy' : 'idle',
      tasksCompleted: jobCounts.completed,
      tasksInProgress: jobCounts.pending,
      lastActive: new Date().toISOString(),
      tasks: jobs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent info' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'logs/app.log');
    if (!existsSync(logPath)) {
      return res.json({ logs: [] });
    }
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n').slice(-50);
    res.json({ logs: lines });
  } catch (error) {
    console.error('[API] Failed to read logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

app.get('/api/telegram/status', async (_req, res) => {
  try {
    const webhookInfo = await getTelegramWebhookInfo();
    res.json({
      pollingActive: isBotPollingActive(),
      webhookInfo,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || 'Failed to read Telegram status',
      pollingActive: isBotPollingActive(),
    });
  }
});

app.post('/api/telegram/delete-webhook', async (req, res) => {
  try {
    const dropPendingUpdates = req.body?.dropPendingUpdates !== false;
    await clearTelegramWebhook(dropPendingUpdates);
    const webhookInfo = await getTelegramWebhookInfo();
    res.json({ success: true, webhookInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to delete webhook' });
  }
});

app.post('/api/telegram/polling/start', async (_req, res) => {
  try {
    if (isBotPollingActive()) {
      res.json({ success: true, pollingActive: true, message: 'Polling already active' });
      return;
    }
    await startBot();
    res.json({ success: true, pollingActive: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to start polling' });
  }
});

app.post('/api/telegram/polling/stop', async (_req, res) => {
  try {
    if (!isBotPollingActive()) {
      res.json({ success: true, pollingActive: false, message: 'Polling already stopped' });
      return;
    }
    await stopBot();
    res.json({ success: true, pollingActive: false });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to stop polling' });
  }
});

app.get('/api/thinking-history', async (req, res) => {
  try {
    const items = await readThinkingHistory();
    res.json({ items });
  } catch (error) {
    console.error('[API] Failed to read thinking history:', error);
    res.status(500).json({ error: 'Failed to read thinking history' });
  }
});

const WEBCHAT_MAX_MESSAGES = 48;
const WEBCHAT_MAX_MSG_LEN = 12000;

app.post('/api/web-chat', async (req, res) => {
  try {
    const raw = req.body?.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'messages must be a non-empty array' });
      return;
    }
    if (raw.length > WEBCHAT_MAX_MESSAGES) {
      res.status(400).json({ error: `At most ${WEBCHAT_MAX_MESSAGES} messages allowed` });
      return;
    }

    const messages: ConversationMessage[] = [];
    for (const m of raw) {
      const role = m?.role;
      const content = typeof m?.content === 'string' ? m.content : '';
      if (role !== 'user' && role !== 'assistant') {
        res.status(400).json({ error: 'Each message needs role "user" or "assistant"' });
        return;
      }
      if (content.length > WEBCHAT_MAX_MSG_LEN) {
        res.status(400).json({ error: `Each message must be at most ${WEBCHAT_MAX_MSG_LEN} characters` });
        return;
      }
      messages.push({ role, content });
    }

    const last = messages[messages.length - 1];
    if (last.role !== 'user' || !String(last.content).trim()) {
      res.status(400).json({ error: 'Last message must be a non-empty user message' });
      return;
    }
    const conversationHistory =
      messages.length > 1 ? messages.slice(0, -1) : undefined;

    const reply = await runTask({
      message: last.content,
      source: 'web',
      conversationHistory,
    });
    res.json({ reply });
  } catch (error: any) {
    console.error('[API] web-chat error:', error);
    res.status(500).json({ error: error?.message || 'Web chat failed' });
  }
});

// API endpoint to trigger a test task
app.post('/api/trigger-task', async (req, res) => {
  try {
    const taskResult = await runTask({
      message: req.body.message || 'Test task from dashboard',
      source: undefined,
    });

    res.json({ success: true, result: taskResult });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to trigger task' });
  }
});

// API endpoint to reset the system
app.post('/api/reset', async (req, res) => {
  try {
    console.log('[API] System reset requested');

    // 1. Clear database tables
    // Use a transaction to ensure atomic deletion
    const deleteMessages = db.prepare('DELETE FROM messages');
    const deleteJobs = db.prepare('DELETE FROM jobs');
    const deleteSessions = db.prepare('DELETE FROM sessions');

    const resetDb = db.transaction(() => {
      deleteMessages.run();
      deleteJobs.run();
      deleteSessions.run();
    });

    resetDb();
    console.log('[API] Database tables cleared');

    // 2. Clear context files
    const contextDir = path.join(process.cwd(), 'src/workspace/context');
    if (existsSync(contextDir)) {
      const files = await fs.readdir(contextDir);
      let deletedCount = 0;
      for (const file of files) {
        // Skip hidden files or directories if any
        if (file.startsWith('.')) continue;

        const filePath = path.join(contextDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      console.log(`[API] ${deletedCount} context files removed`);
    }

    res.json({ success: true, message: 'System reset successful' });
  } catch (error: any) {
    console.error('[API] Reset error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reset system' });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
});

export default app;