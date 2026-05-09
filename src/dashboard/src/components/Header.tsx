import React, { useState, useEffect } from 'react';

interface ProviderData {
  id: string;
  name: string;
}

interface ModelProviderResponse {
  allProviders?: Record<string, ProviderData[]>;
  available?: Array<{ id: string; label: string }>;
  provider?: string;
  modelId?: string;
}

export const Header: React.FC<{
  onOpenWebChat?: () => void;
}> = ({ onOpenWebChat }) => {
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; label: string }>>([]);
  const [provider, setProvider] = useState<string>('');
  const [modelId, setModelId] = useState<string>('');
  const [providerModelMap, setProviderModelMap] = useState<Record<string, ProviderData[]>>({});
  const [currentProvider, setCurrentProvider] = useState<string>('');

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/model-provider');
      const responseData = await response.json();
      setProviderModelMap({});

      if (responseData.allProviders) {
        for (const key of Object.keys(responseData.allProviders)) {
          const models = responseData.allProviders[key].map((m: ProviderData) => ({
            id: m.id,
            name: m.name,
          }));
          setProviderModelMap(prev => ({ ...prev, [key]: models }));
        }
      }

      if (Array.isArray(responseData.available)) {
        setAvailableProviders(responseData.available);
        setProvider(responseData.provider || '');
        setCurrentProvider(responseData.provider || '');
        setModelId(responseData.modelId || '');
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setCurrentProvider(newProvider);
    const models = providerModelMap[newProvider] || [];
    setModelId(models[0]?.id || '');
    await persistModelSelection(newProvider, models[0]?.id || '');
  };

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModelId = e.target.value;
    setModelId(newModelId);
    await persistModelSelection(currentProvider, newModelId);
  };

  const persistModelSelection = async (selectedProvider: string, selectedModel: string) => {
    try {
      await fetch('/api/model-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, modelId: selectedModel }),
      });
    } catch (error) {
      console.error('Error updating model selection:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="relative z-10 border-b border-cyber-blue/20 bg-black/60 backdrop-blur-xl sticky top-0">
      <div className="container mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fas fa-robot text-3xl text-cyber-blue text-glow-blue"></i>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyber-green rounded-full shadow-neon-green animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-white">
              TELE<span className="text-cyber-blue">ZERO</span>
              <span className="text-xs font-light text-cyber-blue/60 ml-2 tracking-widest uppercase">OS v1.0</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 leading-none">Autonomous Agent Interface</p>
          </div>
          {onOpenWebChat && (
            <button
              type="button"
              onClick={onOpenWebChat}
              className="shrink-0 cursor-pointer h-9 px-3 rounded-md border border-cyber-blue/40 bg-cyber-blue/5 text-cyber-blue text-xs font-semibold tracking-wide uppercase hover:bg-cyber-blue/15 hover:border-cyber-blue/60 transition-colors"
            >
              Web chat
            </button>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <label htmlFor="modelProviderSelect" className="text-[10px] uppercase font-bold text-cyber-blue/60 mb-1">Compute Core</label>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <select
                  id="modelProviderSelect"
                  value={provider}
                  onChange={handleProviderChange}
                  className="bg-black/40 border border-cyber-blue/30 text-white text-sm px-3 py-1 rounded-md focus:outline-none focus:border-cyber-blue shadow-inner cursor-pointer appearance-none pr-8 min-w-[120px]"
                >
                  {availableProviders.map((p) => (
                    <option key={p.id} value={p.id}>{p.label.toUpperCase()}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyber-blue/50 pointer-events-none"></i>
              </div>
              <div className="relative">
                <select
                  id="modelSelect"
                  value={modelId}
                  onChange={handleModelChange}
                  className="bg-black/40 border border-cyber-green/30 text-white text-sm px-3 py-1 rounded-md focus:outline-none focus:border-cyber-green shadow-inner cursor-pointer appearance-none pr-8 min-w-[160px]"
                >
                  <option value="">Select Model</option>
                  {providerModelMap[currentProvider]?.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyber-green/50 pointer-events-none"></i>
              </div>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-white/10 mx-2"></div>

          <div className="flex items-center gap-3">
            <span className="badge-cyber badge-cyber-blue">VER 1.0.0</span>
            <span className="badge-cyber badge-cyber-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-ping"></span>
              ONLINE
            </span>
            <button
              onClick={handleLogout}
              className="ml-2 text-white/40 hover:text-red-400 transition-colors cursor-pointer p-2"
              title="Terminate Session"
            >
              <i className="fas fa-power-off"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};