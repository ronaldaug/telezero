import { randomUUID } from 'node:crypto';

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentStepRecord {
  step: number;
  thought: string;
  action?: string | null;
  input?: unknown;
  result?: unknown;
  error?: string;
}

export interface AgentTask {
  id: string;
  userId?: string;
  objective: string;
  history: AgentStepRecord[];
  status: AgentTaskStatus;
  createdAt: Date;
  updatedAt: Date;
  source?: 'telegram' | 'cron' | 'system' | 'web';
}

export interface CreateAgentTaskParams {
  userId?: string;
  objective: string;
  source?: 'telegram' | 'cron' | 'system' | 'web';
}

export function createAgentTask(params: CreateAgentTaskParams): AgentTask {
  const now = new Date();

  return {
    id: randomUUID(),
    userId: params.userId,
    objective: params.objective,
    history: [],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    source: params.source,
  };
}

export function updateTaskStatus(task: AgentTask, status: AgentTaskStatus): AgentTask {
  task.status = status;
  task.updatedAt = new Date();
  return task;
}

