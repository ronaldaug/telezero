import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useSlidingOverlayPresence } from '../hooks/useSlidingOverlayPresence';

export type WebChatMessage = { role: 'user' | 'assistant'; content: string };

export const WebChatDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<WebChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: WebChatMessage = { role: 'user', content: text };
    const nextTranscript: WebChatMessage[] = [...messages, userMsg];
    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch('/api/web-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextTranscript }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      if (typeof data.reply !== 'string') {
        throw new Error('Invalid response from server');
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply! }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const { rendered, entered, onPanelTransitionEnd, panelStyle } = useSlidingOverlayPresence(open);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      {/*
        Opacity-0 does not disable hit testing: the full-screen scrim would still block the page
        and steal every click. Only enable pointer events when the scrim is actually shown.
      */}
      <button
        type="button"
        className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ease-out ${
          entered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        tabIndex={entered ? 0 : -1}
        aria-label="Close web chat"
      />
      <aside
        style={panelStyle}
        onTransitionEnd={onPanelTransitionEnd}
        className={`pointer-events-auto relative w-full max-w-2xl h-full flex flex-col will-change-transform bg-[#080b14] border-r border-cyber-blue/30 shadow-[0_0_40px_rgba(0,242,255,0.15)] transition-transform duration-300 ease-out ${
          entered ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-cyber-blue/20 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Web chat</h2>
            <p className="text-xs text-white/40 mt-1">
              Same agent loop and tools as Telegram: requests run with write_file, list_directory, and other tools (no raw model tool XML in the UI).
            </p>
            <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                className="mt-2 text-white/50 hover:text-white/80 text-xs border border-white/15 rounded px-2 py-1"
              >
                Clear
              </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white text-sm border border-white/20 rounded px-3 py-1"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-white/45">Ask for file or shell actions here; the dashboard runs the same tool loop as the Telegram bot. Prior messages in this panel are sent as context.</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm ${
                m.role === 'user' ? 'text-cyber-blue' : 'text-white/85'
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                {m.role === 'user' ? 'You' : 'Model'}
              </span>
              <p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{m.content}</p>
            </div>
          ))}
          {loading && (
            <p className="text-sm text-cyber-blue/80 animate-pulse">Thinking…</p>
          )}
          {error && (
            <p className="text-sm text-red-400/90 border border-red-500/30 rounded p-2 bg-red-950/20">{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-cyber-blue/20 bg-black/30 shrink-0">
          <div className="flex gap-2 items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={3}
              disabled={loading}
              className="flex-1 bg-black/50 border border-cyber-blue/25 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyber-blue/50 resize-y min-h-10 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="shrink-0 h-10 px-4 rounded-md border border-cyber-blue/50 bg-cyber-blue/10 text-cyber-blue text-sm font-semibold hover:bg-cyber-blue/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
