import { exec, spawn, ChildProcess } from 'child_process';
import chokidar from 'chokidar';
import { join } from 'path';
import 'dotenv/config';

const PORTS_TO_CHECK = [1337, 3000, 8080, 5000];
if (process.env.PORT) PORTS_TO_CHECK.push(parseInt(process.env.PORT));

async function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        exec(`lsof -i :${port} -sTCP:LISTEN -t`, (err, stdout) => {
            resolve(!!stdout.trim());
        });
    });
}

async function main() {
    const asciiArt = `888888 888888 88     888888 8888P 888888 88""Yb  dP"Yb  
  88   88__   88     88__     dP  88__   88__dP dP   Yb 
  88   88""   88  .o 88""    dP   88""   88"Yb  Yb   dP 
  88   888888 88ood8 888888 d8888 888888 88  Yb  YbodP`;
    console.log(asciiArt);
    console.log('');

    // 1. Initial Build/Sync
    console.log('Building and syncing assets...');
    try {
        await new Promise((resolve, reject) => {
            exec('npm run build', (err, stdout, stderr) => {
                if (err) {
                    console.error('Build failed:', stderr);
                    reject(err);
                } else {
                    console.log('  Build successful.');
                    resolve(stdout);
                }
            });
        });
    } catch (e) {
        console.error('Initial build failed. Continuing anyway...');
    }
    console.log('');

    // 2. Port Check
    const inUse = [];
    for (const port of Array.from(new Set(PORTS_TO_CHECK))) {
        if (await checkPort(port)) inUse.push(port);
    }

    if (inUse.length > 0) {
        console.warn('⚠️  Warning: The following ports appear to be in use:');
        inUse.forEach(p => console.warn(`   - ${p}`));
        console.log('');
        // Non-interactive check: we continue anyway in dev mode, but warn.
    }

    console.log('Starting services...');
    console.log('');

    const processes: ChildProcess[] = [];

    // 3. Workspace Watcher
    const workspaceWatcher = chokidar.watch(
        ['src/workspace/skills', 'src/workspace/SOUL.md', 'src/workspace/AGENT_STEP.md'],
        { ignoreInitial: true },
    );

    workspaceWatcher.on('all', (event, path) => {
        console.log(`[watcher] Workspace change detected (${event}: ${path}). Syncing to dist...`);
        exec(
            'mkdir -p dist/workspace && cp -r src/workspace/skills dist/workspace/ && cp src/workspace/SOUL.md dist/workspace/ && cp src/workspace/AGENT_STEP.md dist/workspace/',
            (err) => {
                if (err) console.error('[watcher] Sync failed:', err);
                else console.log('[watcher] Workspace synced to dist.');
            },
        );
    });

    // 4. Start Main App (Bot + Agent)
    console.log('  • Starting main app (Telegram bot + agent)...');
    const appProc = spawn('npx', ['tsx', '--watch', 'src/index.ts'], {
        stdio: 'inherit'
    });
    processes.push(appProc);

    // 5. Start Dashboard
    console.log('  • Starting dashboard on http://localhost:1337...');
    const dashboardProc = spawn('npx', ['tsx', '--watch', 'src/dashboard/real-server.ts'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: '1337', TELEGRAM_AUTO_START: 'false' },
    });
    processes.push(dashboardProc);

    console.log('');
    console.log('✅ All services started successfully');
    console.log('   Dashboard URL: http://localhost:1337');
    console.log('');
    console.log('Press Ctrl+C to stop all services');
    console.log('');

    // Handle shutdown
    const cleanup = () => {
        console.log('\nShutting down services...');
        processes.forEach(p => p.kill());
        workspaceWatcher.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(err => {
    console.error('Launcher error:', err);
    process.exit(1);
});
