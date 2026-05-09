import React, { useState } from 'react';

interface QwenAuthData {
  status: string;
  tokenExpiry: string | null;
  refreshToken: boolean;
  lastRefresh: string | null;
}

interface StatusData {
  qwenAuth: QwenAuthData;
}

export const AuthMatrix: React.FC<{ StatusData }> = ({ data }) => {
  const [showTokenInfo, setShowTokenInfo] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getBadgeClass = (status: string) => {
    if (status === 'authenticated') {
      return 'badge-cyber badge-cyber-green';
    } else if (status === 'expired') {
      return 'badge-cyber badge-cyber-red';
    }
    return 'badge-cyber opacity-50';
  };

  const getBadgeContent = (status: string) => {
    if (status === 'authenticated') {
      return '<i class="fas fa-shield-alt mr-1"></i> Active';
    } else if (status === 'expired') {
      return '<i class="fas fa-exclamation-triangle mr-1"></i> Expired';
    }
    return '<i class="fas fa-question-circle mr-1"></i> Unknown';
  };

  const handleRefreshToken = async () => {
    try {
      const response = await fetch('/api/qwen-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        showNotification('SUCCESS', 'Qwen token refreshed successfully');
      } else {
        showNotification('ERROR', 'Failed to refresh token: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      showNotification('ERROR', 'Network error during refresh');
    }
  };

  const showNotification = (type: 'SUCCESS' | 'ERROR', message: string) => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 ${type === 'SUCCESS' ? 'bg-cyber-green/90 text-cyber-dark' : 'bg-red-600/90 text-white'} px-6 py-3 rounded-lg shadow-neon-blue font-bold z-50 animate-bounce`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const handleTokenInfo = () => {
    const info = [
      `STATUS: ${data.qwenAuth.status.toUpperCase()}`,
      `EXPIRY: ${data.qwenAuth.tokenExpiry ? new Date(data.qwenAuth.tokenExpiry).toLocaleString() : 'N/A'}`,
      `REFRESH TOKEN: ${data.qwenAuth.refreshToken ? 'AVAILABLE' : 'MISSING'}`,
      `LAST REFRESH: ${data.qwenAuth.lastRefresh ? new Date(data.qwenAuth.lastRefresh).toLocaleString() : 'N/A'}`
    ].join('\n');
    alert(info);
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-purple shadow-neon-blue"></div>
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Auth Matrix</h2>
      </div>
      <div className="p-4 rounded shadow cyber-card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-5 text-4xl">
          <i className="fas fa-lock-open"></i>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Provider Status</span>
            <div className={getBadgeClass(data.qwenAuth.status)} dangerouslySetInnerHTML={{ __html: getBadgeContent(data.qwenAuth.status) }} />
          </div>
          <div className="text-2xl font-bold font-mono text-white mb-1">{data.qwenAuth.status.toUpperCase()}</div>
          <div className="text-[10px] text-cyber-blue font-bold uppercase tracking-widest opacity-60">Qwen AI Handshake</div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between text-xs py-2 border-b border-white/5">
            <span className="text-white/40">TOKEN EXPIRY:</span>
            <span className="font-mono text-white">{formatDate(data.qwenAuth.tokenExpiry)}</span>
          </div>
          <div className="flex justify-between text-xs py-2 border-b border-white/5">
            <span className="text-white/40">REFRESHABLE:</span>
            <span className="font-mono text-white">{data.qwenAuth.refreshToken ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between text-xs py-2 border-b border-white/5">
            <span className="text-white/40">LAST SYNC:</span>
            <span className="font-mono text-white">{formatDate(data.qwenAuth.lastRefresh)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRefreshToken}
            className="btn-cyber btn-cyber-primary text-xs flex items-center justify-center gap-2"
          >
            <i className="fas fa-sync-alt"></i> SYNC
          </button>
          <button
            onClick={handleTokenInfo}
            className="btn-cyber btn-cyber-secondary text-xs flex items-center justify-center gap-2"
          >
            <i className="fas fa-info-circle"></i> INFO
          </button>
        </div>
      </div>
    </section>
  );
};