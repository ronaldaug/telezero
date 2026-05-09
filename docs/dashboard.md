# Dashboard

TeleZero includes a web-based monitoring and management dashboard built with Express.js.

## Overview

The dashboard provides:
- **Real-time monitoring** — Server status, agent activity, and system health
- **Qwen authentication** — Token status and management
- **Agent management** — View and trigger agent tasks
- **Responsive UI** — Bootstrap-styled interface accessible from any device

## Access

Start the dashboard:

```bash
pnpm run dashboard
```

The dashboard is available at:

```
http://localhost:3000
```

## Architecture

```
src/dashboard/
├── server.ts          # Express server with routes and API
├── real-server.ts     # Enhanced server with real system integration
└── ...

public/
└── index.html         # Dashboard HTML page
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the dashboard HTML |
| `GET` | `/api/status` | Get system status (server, database, agent health) |
| `POST` | `/api/qwen-refresh` | Manually refresh Qwen authentication token |
| `GET` | `/api/agent-info` | Get detailed agent information and current task |
| `POST` | `/api/trigger-task` | Trigger a test agent task |

### Status Response

```json
{
  "server": {
    "uptime": "2h 15m",
    "memory": "45MB",
    "nodeVersion": "v20.10.0"
  },
  "database": {
    "status": "connected",
    "sessions": 12,
    "jobs": 45
  },
  "agent": {
    "status": "idle",
    "lastTask": "2024-01-15T10:30:00Z"
  }
}
```

## Features

### Server Status

Displays real-time server information including uptime, memory usage, and Node.js version.

### Agent Status

Shows the current state of the agent (idle, running, error) and recent task history.

### Qwen Authentication

If using Qwen as the LLM provider, displays:
- Current token status
- Token expiration time
- Manual refresh button

### Task Management

- View recent agent tasks
- Trigger manual test tasks
- Monitor task completion status

## Development

The dashboard runs as a separate Express server alongside the main application.

### Running Alongside the Main App

```bash
# Terminal 1: Start the main app
pnpm run dev

# Terminal 2: Start the dashboard
pnpm run dashboard
```

### Modifying the Dashboard

1. Edit `src/dashboard/server.ts` for API changes
2. Edit `public/index.html` for UI changes
3. Restart the dashboard to see changes

## Production Deployment

For production, the dashboard can be integrated into the main application or deployed separately:

```bash
pnpm run build
pnpm start
```

Consider adding authentication (e.g., basic auth or token-based) before exposing the dashboard publicly.

## Extending the Dashboard

### Adding a New API Endpoint

```typescript
// src/dashboard/server.ts
app.get('/api/custom-endpoint', (req, res) => {
  const data = getCustomData();
  res.json(data);
});
```

### Adding a New UI Section

Edit `public/index.html` and add a section that fetches from the new endpoint:

```html
<section id="custom-section">
  <h2>Custom Section</h2>
  <div id="custom-data"></div>
</section>

<script>
  fetch('/api/custom-endpoint')
    .then(r => r.json())
    .then(data => {
      document.getElementById('custom-data').textContent = JSON.stringify(data);
    });
</script>
```

## Next Steps

- [Deployment](./deployment.md) — Production deployment strategies
- [Development Guide](./development.md) — Coding standards
