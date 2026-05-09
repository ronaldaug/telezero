import React from 'react';

export const ModelConfiguration: React.FC = () => {
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-green shadow-neon-green"></div>
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Compute Engine</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 rounded shadow cyber-card border-l-4 border-l-cyber-blue">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Model Strategy</h3>
          <p className="text-xs text-white/50 mb-6 leading-relaxed">Toggle between cloud-based high performance and local privacy-first computation.</p>
          <div className="space-y-4">
            <button className="w-full text-left p-3 rounded bg-cyber-blue/5 border border-cyber-blue/20 hover:bg-cyber-blue/10 transition-colors group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase">Cloud Priority</span>
                <i className="fas fa-cloud text-cyber-blue opacity-50 group-hover:opacity-100"></i>
              </div>
              <span className="text-[10px] text-cyber-blue/60 uppercase">High Latency / Max IQ</span>
            </button>
            <button className="w-full text-left p-3 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70 uppercase">Local First</span>
                <i className="fas fa-microchip text-white/30 group-hover:opacity-100"></i>
              </div>
              <span className="text-[10px] text-white/40 uppercase">Zero Latency / Privacy</span>
            </button>
          </div>
        </div>
        <div className="p-4 rounded shadow cyber-card border-l-4 border-l-cyber-green">
          <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Process Log</h3>
          <div className="space-y-3 font-mono text-[10px]">
            <div className="flex gap-2">
              <span className="text-cyber-green">[INFO]</span>
              <span className="text-white/60">System boot sequence complete</span>
            </div>
            <div className="flex gap-2">
              <span className="text-cyber-blue">[AUTH]</span>
              <span className="text-white/60">Provider handshake successful</span>
            </div>
            <div className="flex gap-2 text-white/20">
              <span>[----]</span>
              <span>Waiting for incoming tasks...</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};