import React, { useEffect, useState } from 'react';

interface TelegramStatus {
  pollingActive: boolean;
  webhookInfo?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
  error?: string;
}

export const TelegramControls: React.FC = () => {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>('');

  const fetchStatus = async () => {
    setLoading(true);
    setActionMessage('');
    try {
      const response = await fetch('/api/telegram/status');
      const data = await response.json();
      setStatus(data);
      if (!response.ok) {
        setActionMessage(data.error || 'Failed to fetch Telegram status');
      }
    } catch (error: any) {
      setActionMessage(error?.message || 'Failed to fetch Telegram status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const runAction = async (endpoint: string, body?: Record<string, unknown>) => {
    setLoading(true);
    setActionMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setActionMessage(data.error || 'Action failed');
      } else {
        setActionMessage('Action completed.');
      }
      await fetchStatus();
    } catch (error: any) {
      setActionMessage(error?.message || 'Action failed');
      setLoading(false);
    }
  };

  const webhookUrl = status?.webhookInfo?.url || '';
  const webhookEnabled = webhookUrl.trim() !== '';
  const pendingUpdates = status?.webhookInfo?.pending_update_count ?? 0;
  const webhookError = status?.webhookInfo?.last_error_message;

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-green shadow-neon-green"></div>
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Telegram Controls</h2>
      </div>

      <div className="p-4 rounded shadow cyber-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-black/30 rounded border border-white/10">
            <div className="text-[10px] uppercase text-white/40 mb-1">Polling</div>
            <div className={status?.pollingActive ? 'text-cyber-green font-semibold' : 'text-white/80 font-semibold'}>
              {status?.pollingActive ? 'Active' : 'Stopped'}
            </div>
          </div>
          <div className="p-3 bg-black/30 rounded border border-white/10">
            <div className="text-[10px] uppercase text-white/40 mb-1">Webhook</div>
            <div className={webhookEnabled ? 'text-cyber-blue font-semibold' : 'text-white/80 font-semibold'}>
              {webhookEnabled ? 'Configured' : 'Not configured'}
            </div>
          </div>
        </div>

        <div className="text-xs text-white/70 space-y-1">
          <div>Pending updates: <span className="text-white">{pendingUpdates}</span></div>
          <div className="truncate">Webhook URL: <span className="text-white">{webhookEnabled ? webhookUrl : 'None'}</span></div>
          {webhookError ? <div className="text-red-400">Last webhook error: {webhookError}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={fetchStatus}
            className="h-9 px-3 rounded border border-cyber-blue/40 bg-cyber-blue/5 text-cyber-blue text-xs font-semibold uppercase tracking-wide hover:bg-cyber-blue/15 disabled:opacity-50"
          >
            Refresh status
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runAction('/api/telegram/delete-webhook', { dropPendingUpdates: true })}
            className="h-9 px-3 rounded border border-yellow-400/40 bg-yellow-400/5 text-yellow-300 text-xs font-semibold uppercase tracking-wide hover:bg-yellow-400/15 disabled:opacity-50"
          >
            Delete webhook
          </button>
          <button
            type="button"
            disabled={loading || !!status?.pollingActive}
            onClick={() => runAction('/api/telegram/polling/start')}
            className="h-9 px-3 rounded border border-cyber-green/40 bg-cyber-green/5 text-cyber-green text-xs font-semibold uppercase tracking-wide hover:bg-cyber-green/15 disabled:opacity-50"
          >
            Start polling
          </button>
          <button
            type="button"
            disabled={loading || !status?.pollingActive}
            onClick={() => runAction('/api/telegram/polling/stop')}
            className="h-9 px-3 rounded border border-red-400/40 bg-red-500/5 text-red-300 text-xs font-semibold uppercase tracking-wide hover:bg-red-500/15 disabled:opacity-50"
          >
            Stop polling
          </button>
        </div>

        {actionMessage ? <div className="text-xs text-white/70">{actionMessage}</div> : null}
      </div>
    </section>
  );
};
