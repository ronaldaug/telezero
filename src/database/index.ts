import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * SQLite file path. Hosts such as Render set `DATABASE_URL` to a `postgres://`
 * (or similar) URL when a managed database is attached; that must not be used
 * as a SQLite path.
 */
function resolveSqliteDatabasePath(): string {
    const explicit =
        process.env.TELEZERO_SQLITE_PATH?.trim() || process.env.SQLITE_DATABASE_PATH?.trim();
    if (explicit) {
        return explicit;
    }

    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
        return 'data/telezero.db';
    }

    if (/^(postgres(ql)?|mysql|mariadb):\/\//i.test(databaseUrl)) {
        return 'data/telezero.db';
    }

    return databaseUrl;
}

const DB_PATH = resolveSqliteDatabasePath();

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

export function migrate() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log('Database migrated successfully.');
}

export interface Session {
    chat_id: number;
    user_id: number;
    context_json: string;
    last_active: string;
    created_at: string;
}

export interface Job {
    id: number;
    chat_id: number;
    skill_name: string;
    args_json: string;
    status: 'pending' | 'completed' | 'failed';
    scheduled_at: string;
    created_at: string;
}

export interface Message {
    id: number;
    chat_id: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

/**
 * Save a message (user or assistant) for a given chat.
 */
export function saveMessage(chatId: number, role: 'user' | 'assistant', content: string): void {
    db.prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)').run(chatId, role, content);
}

/**
 * Retrieve recent conversation messages for a chat, ordered oldest-first.
 * @param limit Maximum number of messages to retrieve (default 50).
 */
export function getRecentMessages(chatId: number, limit = 50): Message[] {
    return db.prepare(
        'SELECT * FROM (SELECT * FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?) sub ORDER BY id ASC'
    ).all(chatId, limit) as Message[];
}
