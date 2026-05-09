import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const USER_MD = path.join(repoRoot, 'src/workspace/USER.md');
const AGENT_STEP_MD = path.join(repoRoot, 'src/workspace/AGENT_STEP.md');
const IDENTITY_MD = path.join(repoRoot, 'src/workspace/IDENTITY.md');
const SOUL_MD = path.join(repoRoot, 'src/workspace/SOUL.md');
const ENV_FILE = path.join(repoRoot, '.env');
const ENV_EXAMPLE_FILE = path.join(repoRoot, '.env.example');

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceWord(source: string, before: string, after: string): string {
    if (!before || before === after) return source;
    return source.replace(new RegExp(`\\b${escapeRegExp(before)}\\b`, 'g'), after);
}

async function askRequired(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
    while (true) {
        const answer = (await rl.question(question)).trim();
        if (answer.length > 0) return answer;
        console.log('This value is required. Please enter a value.');
    }
}

async function readText(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
}

async function writeText(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf8');
}

function detectOwnerName(userMd: string): string {
    const nameMatch = userMd.match(/^- Name:\s*(.+)$/m);
    if (nameMatch && nameMatch[1]) return nameMatch[1].trim();
    return 'Ronald';
}

function detectAgentName(identityMd: string): string {
    const strongMatch = identityMd.match(/\*\*([^*]+)\*\*/);
    if (strongMatch && strongMatch[1]) return strongMatch[1].trim();
    return 'TeleZero';
}

function upsertEnvVar(envContent: string, key: string, value: string): string {
    const lines = envContent.split('\n');
    const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
    let replaced = false;

    for (let i = 0; i < lines.length; i += 1) {
        if (keyPattern.test(lines[i])) {
            lines[i] = `${key}=${value}`;
            replaced = true;
            break;
        }
    }

    if (!replaced) {
        if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
            lines.push('');
        }
        lines.push(`${key}=${value}`);
    }

    return lines.join('\n');
}

async function ensureEnvFile(): Promise<void> {
    if (existsSync(ENV_FILE)) return;
    if (existsSync(ENV_EXAMPLE_FILE)) {
        const example = await readText(ENV_EXAMPLE_FILE);
        await writeText(ENV_FILE, example);
        return;
    }
    await writeText(ENV_FILE, '');
}

async function main(): Promise<void> {
    console.log('TeleZero setup');
    console.log('');

    const rl = createInterface({ input, output });

    try {
        await ensureEnvFile();

        const userMd = await readText(USER_MD);
        const agentStepMd = await readText(AGENT_STEP_MD);
        const identityMd = await readText(IDENTITY_MD);
        const soulMd = await readText(SOUL_MD);
        const envText = await readText(ENV_FILE);

        const existingOwnerName = detectOwnerName(userMd);
        const existingAgentName = detectAgentName(identityMd);

        const ownerName = await askRequired(rl, 'What do you want Agent to call you? ');
        const agentName = await askRequired(rl, 'What is your agent name? ');
        const telegramBotToken = await askRequired(rl, 'TELEGRAM_BOT_TOKEN: ');
        const telegramChatId = await askRequired(rl, 'TELEGRAM_CHAT_ID: ');
        const openrouterApiKey = (await rl.question('OPENROUTER_API_KEY (optional): ')).trim();
        const geminiApiKey = (await rl.question('GEMINI_API_KEY (optional): ')).trim();

        let nextUserMd = replaceWord(userMd, existingOwnerName, ownerName);
        let nextAgentStepMd = replaceWord(agentStepMd, existingOwnerName, ownerName);
        nextAgentStepMd = replaceWord(nextAgentStepMd, existingAgentName, agentName);
        const nextIdentityMd = replaceWord(identityMd, existingAgentName, agentName);
        const nextSoulMd = replaceWord(soulMd, existingAgentName, agentName);

        // Keep the explicit profile name line accurate even if older names are missing.
        nextUserMd = nextUserMd.replace(/^- Name:\s*.+$/m, `- Name: ${ownerName}`);

        let nextEnv = envText;
        nextEnv = upsertEnvVar(nextEnv, 'TELEGRAM_BOT_TOKEN', telegramBotToken);
        nextEnv = upsertEnvVar(nextEnv, 'TELEGRAM_CHAT_ID', telegramChatId);
        if (openrouterApiKey.length > 0) {
            nextEnv = upsertEnvVar(nextEnv, 'OPENROUTER_API_KEY', openrouterApiKey);
        }
        if (geminiApiKey.length > 0) {
            nextEnv = upsertEnvVar(nextEnv, 'GEMINI_API_KEY', geminiApiKey);
        }

        await Promise.all([
            writeText(USER_MD, nextUserMd),
            writeText(AGENT_STEP_MD, nextAgentStepMd),
            writeText(IDENTITY_MD, nextIdentityMd),
            writeText(SOUL_MD, nextSoulMd),
            writeText(ENV_FILE, nextEnv),
        ]);

        console.log('');
        console.log('Running build (`npm run build`)...');
        execSync('npm run build', {
            cwd: repoRoot,
            stdio: 'inherit',
        });

        console.log('');
        console.log('Building dashboard (`npm run dashboard:build`)...');
        execSync('npm run dashboard:build', {
            cwd: repoRoot,
            stdio: 'inherit',
        });

        console.log('');
        console.log('Setup complete.');
        console.log('');
        console.log('Next steps:');
        console.log('- Read and configure LLM models in `.telezero-model.json`.');
        console.log('- Create skills at `/src/workspace/<skill>/SKILL.md`.');
        console.log('- Run `npm run telezero`.');
    } finally {
        rl.close();
    }
}

main().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
});
