import express from 'express';
import path from 'path';
import { existsSync, promises as fs } from 'node:fs';

const app = express();
const PORT = parseInt(process.env.PORT || '80', 10);

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Middleware to parse JSON
app.use(express.json());

// Mock data for demonstration purposes
const mockStatusData = {
  server: {
    uptime: '2 days, 4 hours, 32 minutes',
    status: 'running',
    version: '1.0.0',
    lastRestart: '2026-03-08T14:22:00Z'
  },
  agent: {
    status: 'active',
    tasksCompleted: 124,
    tasksInProgress: 2,
    lastActive: '2026-03-10T17:45:00Z'
  },
  qwenAuth: {
    status: 'authenticated',
    tokenExpiry: '2026-03-11T17:45:00Z',
    refreshToken: true,
    lastRefresh: '2026-03-10T16:45:00Z'
  },
  maxAgentLoopSteps: 40,
  agentLoopStepsBounds: { min: 20, max: 80 }
};

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function titleFromLine12(content: string, fallback: string): string {
  const lines = content.split(/\r?\n/);
  const line12 = lines[11] ?? '';
  const cleaned = line12
    .replace(/^\s*#+\s*/g, '')
    .replace(/^\s*objective\s*[:\-]?\s*/i, '')
    .trim();
  if (!cleaned) return fallback;
  return truncateWords(cleaned, 30);
}

// Route to serve the dashboard HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// API endpoint to get status data
app.get('/api/status', (req, res) => {
  res.json(mockStatusData);
});

app.post('/api/agent-loop-steps', (req, res) => {
  const raw = req.body?.maxSteps;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    res.status(400).json({ success: false, error: 'maxSteps must be a number' });
    return;
  }
  const v = Math.min(80, Math.max(20, Math.round(n)));
  mockStatusData.maxAgentLoopSteps = v;
  res.json({ success: true, maxAgentLoopSteps: v });
});

app.post('/api/web-chat', async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages must be a non-empty array' });
      return;
    }
    res.json({
      reply: `[Mock dashboard] You said: ${JSON.stringify(messages[messages.length - 1]?.content ?? '')}. Start the real server (src/dashboard/real-server) for the full agent and tools.`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Web chat failed' });
  }
});

app.get('/api/thinking-history', async (req, res) => {
  try {
    const contextDir = path.join(process.cwd(), 'src/workspace/context');
    if (!existsSync(contextDir)) {
      res.json({ items: [] });
      return;
    }

    const entries = await fs.readdir(contextDir, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map(async (entry) => {
          const filePath = path.join(contextDir, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');
          const title = titleFromLine12(content, entry.name.replace(/\.md$/i, ''));
          const stats = await fs.stat(filePath);
          return { id: entry.name, title, content, updatedAt: stats.mtime.toISOString() };
        }),
    );

    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read thinking history' });
  }
});

// API endpoint to refresh Qwen token
app.post('/api/qwen-refresh', async (req, res) => {
  try {
    // Simulate token refresh
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In a real implementation, this would call the actual Qwen refresh logic
    const newStatus = {
      ...mockStatusData.qwenAuth,
      status: 'authenticated',
      tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastRefresh: new Date().toISOString()
    };

    res.json({ success: true, status: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to refresh token' });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
});

export default app;