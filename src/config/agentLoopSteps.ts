import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const AGENT_LOOP_STEPS_MIN = 20;
export const AGENT_LOOP_STEPS_MAX = 80;
export const AGENT_LOOP_STEPS_DEFAULT = 40;

const FILENAME = '.telezero-agent.json';

interface AgentLoopConfigFile {
  maxLoopSteps?: number;
}

function configPath(): string {
  return path.join(process.cwd(), FILENAME);
}

function clamp(n: number): number {
  return Math.min(AGENT_LOOP_STEPS_MAX, Math.max(AGENT_LOOP_STEPS_MIN, Math.round(n)));
}

export function getAgentLoopSteps(): number {
  try {
    const p = configPath();
    if (!existsSync(p)) return AGENT_LOOP_STEPS_DEFAULT;
    const raw = readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as AgentLoopConfigFile;
    if (typeof data.maxLoopSteps !== 'number' || !Number.isFinite(data.maxLoopSteps)) {
      return AGENT_LOOP_STEPS_DEFAULT;
    }
    return clamp(data.maxLoopSteps);
  } catch {
    return AGENT_LOOP_STEPS_DEFAULT;
  }
}

export function setAgentLoopSteps(steps: number): number {
  const value = clamp(steps);
  writeFileSync(configPath(), JSON.stringify({ maxLoopSteps: value }, null, 2) + '\n', 'utf-8');
  return value;
}
