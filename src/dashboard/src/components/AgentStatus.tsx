import React, { useEffect, useRef } from 'react';

interface AgentStatusData {
  status: string;
  tasksCompleted: number;
  tasksInProgress: number;
  lastActive: string;
}

export const AgentStatus: React.FC<{ data: AgentStatusData }> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw rotating ring
      ctx.beginPath();
      ctx.arc(50, 50, 40, angle, angle + Math.PI * 1.5);
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw inner ring
      ctx.beginPath();
      ctx.arc(50, 50, 30, -angle * 1.5, -angle * 1.5 + Math.PI);
      ctx.strokeStyle = '#00ff9d';
      ctx.lineWidth = 1;
      ctx.stroke();

      angle += 0.05;
      requestAnimationFrame(draw);
    }
    draw();

    return () => {
      // Cleanup animation
    };
  }, []);

  const getBadgeClass = (status: string) => {
    if (status === 'busy') {
      return 'badge-cyber badge-cyber-blue animate-pulse';
    }
    return 'badge-cyber badge-cyber-green';
  };

  const getBadgeContent = (status: string) => {
    if (status === 'busy') {
      return '<i class="fas fa-spinner fa-spin mr-1"></i> Busy';
    }
    return '<i class="fas fa-check-circle mr-1"></i> Idle';
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-blue shadow-neon-blue"></div>
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Neural Hub</h2>
      </div>
      <div className="p-4 rounded shadow cyber-card overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8 items-center bg-white/5 -m-6 p-6 mb-6">
          <div className="relative">
            <canvas ref={canvasRef} width="100" height="100" className="opacity-80"></canvas>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fas fa-brain text-4xl text-cyber-blue/50"></i>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-white mb-1">AGENT CORE STATUS</h3>
            <p className="text-sm text-white/50 mb-4 font-light">Monitoring real-time cognitive cycles and skill execution.</p>
            <div
              className="inline-block px-8 py-2 border border-cyber-blue text-cyber-blue font-bold tracking-[0.3em] text-xs skew-x-[-12deg]"
              dangerouslySetInnerHTML={{ __html: getBadgeContent(data.status) }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-black/30 rounded border border-white/5">
            <span className="text-[10px] uppercase text-white/30 font-bold block mb-1">Primary State</span>
            <div className="text-lg font-mono text-cyber-blue">{data.status.toUpperCase()}</div>
          </div>
          <div className="p-4 bg-black/30 rounded border border-white/5">
            <span className="text-[10px] uppercase text-white/30 font-bold block mb-1">Compute Precision</span>
            <div className="text-lg font-mono text-white">STABLE</div>
          </div>
        </div>
      </div>
    </section>
  );
};