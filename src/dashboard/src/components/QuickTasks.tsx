import React from 'react';

export const QuickTasks: React.FC = () => {
  const handleResetSystem = async () => {
    const confirmMessage = "WARNING: This will permanently DELETE all database records and ALL context files. Are you sure you want to proceed?";
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        alert('SUCCESS: System reset successful. All data wiped.');
        window.location.reload();
      } else {
        alert('ERROR: Failed to reset system: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resetting system:', error);
      alert('ERROR: Network error during reset');
    }
  };

  const handleDiagnostic = () => {
    alert('Running diagnostic tests...');
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-pink shadow-neon-blue"></div>
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Quick Tasks</h2>
      </div>
      <div className="p-4 rounded shadow cyber-card">
        <button
          onClick={handleDiagnostic}
          className="w-full p-4 rounded bg-white/5 border border-white/10 hover:border-cyber-pink/40 hover:bg-cyber-pink/5 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <i className="fas fa-vial text-cyber-pink group-hover:scale-110 transition-transform"></i>
            <div>
              <div className="text-xs font-bold text-white uppercase">Run Diagnostic</div>
              <div className="text-[9px] text-white/30 uppercase tracking-tighter">Execute full system self-test</div>
            </div>
          </div>
        </button>
      </div>

      <div className="p-4 rounded shadow cyber-card border-t-2 border-red-500/30 mt-4">
        <button
          onClick={handleResetSystem}
          className="w-full p-4 rounded bg-red-500/5 border border-red-500/20 hover:border-red-500/60 hover:bg-red-500/10 transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <i className="fas fa-trash-alt text-red-500 group-hover:scale-110 transition-transform"></i>
            <div>
              <div className="text-xs font-bold text-white uppercase">Reset System</div>
              <div className="text-[9px] text-red-500/70 uppercase tracking-tighter">Wipe all databases & contexts</div>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
};