import React from 'react';

export interface StatsData {
  server: {
    uptime: string;
    status: string;
    version: string;
    lastRestart: string;
  };
  agent: {
    status: string;
    tasksCompleted: number;
    tasksInProgress: number;
    lastActive: string;
  };
  maxAgentLoopSteps?: number;
  agentLoopStepsBounds?: { min: number; max: number };
}

export const StatsOverview: React.FC<{ data: StatsData }> = ({ data }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--:--:--';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {/* Uptime */}
      <div className="p-4 rounded shadow cyber-card group">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-cyber-blue/10 p-2 rounded-lg text-cyber-blue">
            <i className="fas fa-clock text-xl"></i>
          </div>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">System Health</span>
        </div>
        <div className="text-3xl font-bold text-white tracking-tight">{data.server.uptime}</div>
        <div className="text-[10px] text-cyber-blue font-bold uppercase mt-1 tracking-widest opacity-60">System Uptime</div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-white/40">LAST RESTART:</span>
          <span className="text-white/80 font-mono">{formatDate(data.server.lastRestart)}</span>
        </div>
      </div>

      {/* Tasks Completed */}
      <div className="p-4 rounded shadow cyber-card p-4 rounded shadow cyber-card-green group">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-cyber-green/10 p-2 rounded-lg text-cyber-green">
            <i className="fas fa-check-circle text-xl"></i>
          </div>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Efficiency</span>
        </div>
        <div className="text-3xl font-bold text-white tracking-tight">{data.agent.tasksCompleted}</div>
        <div className="text-[10px] text-cyber-green font-bold uppercase mt-1 tracking-widest opacity-60">Tasks Processed</div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-white/40">SUCCESS RATE:</span>
          <span className="text-white/80 font-mono">100%</span>
        </div>
      </div>

      {/* In Progress */}
      <div className="p-4 rounded shadow cyber-card group">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-cyber-pink/10 p-2 rounded-lg text-cyber-pink">
            <i className="fas fa-bolt text-xl"></i>
          </div>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Active load</span>
        </div>
        <div className="text-3xl font-bold text-white tracking-tight">{data.agent.tasksInProgress}</div>
        <div className="text-[10px] text-cyber-pink font-bold uppercase mt-1 tracking-widest opacity-60">Current Jobs</div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[11px]">
          <span className="text-white/40">VERSION:</span>
          <span className="text-white/80 font-mono">{data.server.version}</span>
        </div>
      </div>
    </div>
  );
};