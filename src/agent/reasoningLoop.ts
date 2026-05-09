import { AgentTask, AgentStepRecord, updateTaskStatus } from './agentTask.js';
import { generateAgentStep, AgentStepResponse, AgentToolDescription } from '../llm/llmClient.js';
import { getAgentLoopSteps } from '../config/agentLoopSteps.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface AgentTool {
  name: string;
  description: string;
  execute: (input: unknown) => Promise<unknown>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunReasoningLoopOptions {
  maxSteps?: number;
  conversationHistory?: ConversationMessage[];
}

export interface RunReasoningLoopResult {
  finalAnswer: string;
  task: AgentTask;
}

export async function runReasoningLoop(
  task: AgentTask,
  tools: AgentTool[],
  options: RunReasoningLoopOptions = {},
): Promise<RunReasoningLoopResult> {
  const maxSteps = options.maxSteps ?? getAgentLoopSteps();

  if (tools.length === 0) {
    throw new Error('No tools registered for reasoning loop.');
  }

  updateTaskStatus(task, 'running');

  const toolDescriptions: AgentToolDescription[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));

  console.log(
    '[Agent] task=%s source=%s objective=%s maxSteps=%d',
    task.id.slice(0, 8),
    task.source ?? '—',
    task.objective.slice(0, 60),
    maxSteps,
  );

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const stepNumber = stepIndex + 1;

    const llmStep: AgentStepResponse = await generateAgentStep({
      objective: task.objective,
      history: task.history,
      tools: toolDescriptions,
      conversationHistory: options.conversationHistory,
    });

    const stepRecord: AgentStepRecord = {
      step: stepNumber,
      thought: llmStep.thought,
      action: llmStep.action,
      input: llmStep.input,
    };

    console.log('[Agent] step %d thought=%s action=%s done=%s', stepNumber, (llmStep.thought || '').slice(0, 80), llmStep.action ?? '-', llmStep.done);

    // If the model indicates the task is complete, stop here.
    if (llmStep.done) {
      updateTaskStatus(task, 'completed');
      stepRecord.result = llmStep.final_answer;
      task.history.push(stepRecord);
      console.log('[Agent] completed final_answer=%s', (llmStep.final_answer ?? '').slice(0, 120));

      // Fallback: if LLM set done=true but omitted final_answer, use the thought
      // field (which usually contains a useful summary) instead of an error message.
      const finalAnswer =
        llmStep.final_answer ||
        llmStep.thought ||
        'The task was completed.';

      const result: RunReasoningLoopResult = {
        finalAnswer,
        task,
      };
      await saveReasoningLog(task);
      return result;
    }

    // If there is an action, try to execute the corresponding tool.
    if (llmStep.action) {
      const tool = tools.find((t) => t.name === llmStep.action);

      if (!tool) {
        stepRecord.error = `Unknown tool: ${llmStep.action}`;
        task.history.push(stepRecord);
        console.log('[Agent] step %d error=Unknown tool: %s', stepNumber, llmStep.action);
        continue;
      }

      try {
        const result = await tool.execute(llmStep.input);
        stepRecord.result = result;
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        console.log('[Agent] step %d tool=%s result=%s', stepNumber, llmStep.action, resultStr.slice(0, 200));
      } catch (error: any) {
        stepRecord.error = error?.message ?? String(error);
        console.log('[Agent] step %d tool=%s error=%s', stepNumber, llmStep.action, stepRecord.error);
      }
    }

    task.history.push(stepRecord);
    task.updatedAt = new Date();
  }

  updateTaskStatus(task, 'failed');
  console.log('[Agent] max steps reached; history length=%d', task.history.length);

  const failResult: RunReasoningLoopResult = {
    finalAnswer:
      'The agent reached the maximum number of reasoning steps without completing the task. Please refine the objective or try again.',
    task,
  };
  await saveReasoningLog(task);
  return failResult;
}

const CONTEXT_DIR = join(process.cwd(), 'src', 'workspace', 'context');

/**
 * Write the full reasoning trace for this task to a markdown file.
 * File name: [session-id]-[timestamp].md
 */
async function saveReasoningLog(task: AgentTask): Promise<void> {
  try {
    if (!existsSync(CONTEXT_DIR)) {
      await mkdir(CONTEXT_DIR, { recursive: true });
    }

    const ts = task.createdAt.toISOString().replace(/[:.]/g, '-');
    const shortId = task.id.slice(0, 8);
    const filename = `${shortId}-${ts}.md`;
    const filepath = join(CONTEXT_DIR, filename);

    const lines: string[] = [
      `# Agent Reasoning Log`,
      '',
      `- **Session ID**: ${task.id}`,
      `- **User ID**: ${task.userId ?? 'N/A'}`,
      `- **Source**: ${task.source ?? 'N/A'}`,
      `- **Status**: ${task.status}`,
      `- **Created**: ${task.createdAt.toISOString()}`,
      `- **Updated**: ${task.updatedAt.toISOString()}`,
      '',
      `## Objective`,
      '',
      task.objective,
      '',
      `## Steps`,
      '',
    ];

    for (const step of task.history) {
      lines.push(`### Step ${step.step}`);
      lines.push('');
      lines.push(`**Thought**: ${step.thought}`);
      if (step.action) {
        lines.push(`**Action**: ${step.action}`);
        lines.push(`**Input**: \`\`\`json\n${JSON.stringify(step.input, null, 2)}\n\`\`\``);
      }
      if (step.result !== undefined) {
        const resultStr = typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2);
        lines.push(`**Result**: \`\`\`\n${resultStr.slice(0, 2000)}\n\`\`\``);
      }
      if (step.error) {
        lines.push(`**Error**: ${step.error}`);
      }
      lines.push('');
    }

    await writeFile(filepath, lines.join('\n'), 'utf-8');
    console.log('[Agent] reasoning log saved: %s', filepath);
  } catch (err) {
    console.error('[Agent] failed to save reasoning log:', err);
  }
}

