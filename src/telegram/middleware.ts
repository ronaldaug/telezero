import { db } from '../database/index.js';

export const sessionMiddleware = async (context: any, next: () => Promise<unknown>) => {
    const chatId = context.chatId;
    if (!chatId) return next();

    let session = db.prepare('SELECT * FROM sessions WHERE chat_id = ?').get(chatId) as any;

    if (!session) {
        db.prepare('INSERT INTO sessions (chat_id, user_id, context_json) VALUES (?, ?, ?)')
          .run(chatId, context.from?.id, JSON.stringify({}));
        session = { chat_id: chatId, user_id: context.from?.id, context_json: '{}' };
    }

    context.session = JSON.parse(session.context_json);
    
    const result = await next();

    // Save session back
    db.prepare('UPDATE sessions SET context_json = ?, last_active = CURRENT_TIMESTAMP WHERE chat_id = ?')
      .run(JSON.stringify(context.session), chatId);

    return result;
};
