import { createAgentTask } from './agentTask.js';
import { runReasoningLoop, AgentTool } from './reasoningLoop.js';
import { getAgentLoopSteps } from '../config/agentLoopSteps.js';
import { writeFile, readFile, listDirectory } from '../tools/filesystem.js';
import { runCommand } from '../tools/shell.js';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunTaskParams {
  userId?: string | number;
  message: string;
  source?: 'telegram' | 'cron' | 'system' | 'web';
  conversationHistory?: ConversationMessage[];
}

const tools: AgentTool[] = [
  {
    name: 'write_file',
    description: 'Write text content to a file on disk. Expects { "path": string, "content": string }.',
    execute: async (input) => writeFile(input as any),
  },
  {
    name: 'read_file',
    description: 'Read text content from a file on disk. Expects { "path": string }.',
    execute: async (input) => readFile(input as any),
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a given path. Expects { "path": string }.',
    execute: async (input) => listDirectory(input as any),
  },
  {
    name: 'run_command',
    description: 'Run a shell command on the server. Expects { "command": string, "cwd"?: string }.',
    execute: async (input) => runCommand(input as any),
  },
];

/** Don't send raw agent JSON (thought/action/input) to the user. */
function sanitizeFinalAnswer(text: string): string {
  const t = text.trim();
  if (!t) return 'No response.';
  // If it looks like internal agent JSON, don't expose it
  if (
    (t.startsWith('{') && t.includes('"action"') && t.includes('"thought"')) ||
    (t.includes('"input":') && t.includes('"action":'))
  ) {
    return "I ran through the steps but couldn't format a clear reply. The task may have completed—please check (e.g. your Notion page) or try asking again.";
  }
  return t;
}

export async function runTask(params: RunTaskParams): Promise<string> {
  const objective = params.message;

  const task = createAgentTask({
    userId: params.userId ? String(params.userId) : undefined,
    objective,
    source: params.source,
  });

  const { finalAnswer } = await runReasoningLoop(task, tools, {
    maxSteps: getAgentLoopSteps(),
    conversationHistory: params.conversationHistory,
  });

  return sanitizeFinalAnswer(finalAnswer);
}

