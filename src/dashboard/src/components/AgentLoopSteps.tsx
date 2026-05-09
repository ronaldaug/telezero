import React, { useEffect, useState } from 'react';

const DEFAULT_MIN = 20;
const DEFAULT_MAX = 80;

export const AgentLoopSteps: React.FC<{
  maxAgentLoopSteps: number;
  min?: number;
  max?: number;
  onAfterSave?: () => void;
}> = ({ maxAgentLoopSteps, min = DEFAULT_MIN, max = DEFAULT_MAX, onAfterSave }) => {
  const [steps, setSteps] = useState(maxAgentLoopSteps);

  useEffect(() => {
    setSteps(maxAgentLoopSteps);
  }, [maxAgentLoopSteps]);

  const persist = async (value: number) => {
    try {
      const res = await fetch('/api/agent-loop-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSteps: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      onAfterSave?.();
    } catch (e) {
      console.error('Failed to save agent loop steps:', e);
    }
  };

  const hintLow = steps >= 20 && steps <= 30;
  const hintHigh = steps >= 50 && steps <= 80;

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-1 bg-cyber-pink shadow-[0_0_12px_rgba(255,0,200,0.4)]" />
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Agent loop steps</h2>
      </div>
      <div className="p-4 rounded shadow cyber-card border-l-4 border-l-cyber-pink">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <p className="text-xs text-white/50 leading-relaxed">
            Maximum reasoning steps per task (affects Telegram, cron, and dashboard-triggered runs).
          </p>
          <span className="text-2xl font-bold text-white font-mono tabular-nums shrink-0">{steps}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          onPointerUp={(e) => {
            const v = Number((e.currentTarget as HTMLInputElement).value);
            setSteps(v);
            void persist(v);
          }}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-cyber-pink"
          aria-label="Agent loop steps"
        />
        <div className="flex justify-between text-[10px] text-white/30 font-mono mt-2">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        {hintLow && (
          <p className="mt-4 text-xs text-amber-200/90 leading-relaxed border-t border-white/5 pt-4">
            Sometimes, the agent may not complete the task with just 20–30 steps.
          </p>
        )}
        {hintHigh && (
          <p className="mt-4 text-xs text-amber-200/90 leading-relaxed border-t border-white/5 pt-4">
            If the agent hallucinates, longer steps could result in higher costs.
          </p>
        )}
      </div>
    </section>
  );
};
