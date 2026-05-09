#!/usr/bin/env tsx
import { spawn } from 'child_process';

async function main() {
    console.log('📊 Starting TeleZero Dashboard...');
    console.log('');

    // Start the dashboard server
    const dashboardProc = spawn('tsx', ['--watch', 'src/dashboard/real-server.ts'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: '1337' }
    });

    // Keep the process alive
    dashboardProc.on('close', (code) => {
        console.log(`Dashboard server exited with code ${code}`);
        process.exit(code || 0);
    });

    // Handle shutdown gracefully
    process.on('SIGINT', () => {
        console.log('\nShutting down dashboard server...');
        dashboardProc.kill();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Failed to start dashboard:', error);
    process.exit(1);
});