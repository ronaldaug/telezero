import React, { useEffect, useState } from 'react';

export const AppLogs: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Fetch every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 rounded shadow cyber-card overflow-hidden h-full relative min-h-[300px]">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-4 w-1 bg-cyber-blue shadow-neon-blue"></div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/70">Logs</h3>
      </div>
      <div className="relative h-[220px] overflow-hidden">
        <div className="animate-marquee-vertical space-y-3">
          {logs.length > 0 ? (
            <>
              {logs.map((log, index) => (
                <div key={`log-${index}`} className="font-mono text-[10px] text-cyber-blue/80 whitespace-normal break-all border-l border-white/10 pl-3 py-1">
                  <span className="text-cyber-green mr-2 opacity-50">{log.substring(0, 19)}</span>
                  <span className="text-white/90">{log.substring(20)}</span>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {logs.map((log, index) => (
                <div key={`dup-${index}`} className="font-mono text-[10px] text-cyber-blue/80 whitespace-normal break-all border-l border-white/10 pl-3 py-1">
                  <span className="text-cyber-green mr-2 opacity-50">{log.substring(0, 19)}</span>
                  <span className="text-white/90">{log.substring(20)}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="text-[10px] text-white/30 italic">No logs available...</div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
    </div>
  );
};
