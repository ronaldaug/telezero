import { promises as fs } from 'node:fs';
import path from 'path';
import { QwenCodeHandler } from '../services/qwen-provider.js';
import { OllamaCodeHandler } from '../services/ollama-provider.js';
import { OpenAICompatibleHandler } from '../services/openai-compatible-provider.js';
import { GeminiHandler } from '../services/gemini-provider.js';
import {
  getSoulContext,
  getIdentityContext,
  getUserContext,
  getToolsContext,
  getHeartbeatContext,
  getSkillsContext,
  getSkillDirectoryNamesLine,
  getAgentStepPromptTemplate,
} from '../workspace/agentContext.js';

export interface AgentToolDescription {
  name: string;
  description: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateAgentStepContext {
  objective: string;
  history: unknown[];
  tools: AgentToolDescription[];
  conversationHistory?: ConversationMessage[];
}

export interface AgentStepResponse {
  thought: string;
  action?: string | null;
  input?: unknown;
  done: boolean;
  final_answer?: string;
}

export type ModelProvider = 'qwen' | 'ollama' | 'openai' | 'openrouter' | 'gemini';

let currentProvider: ModelProvider = 'qwen';

const MODEL_CONFIG_FILENAME = '.telezero-model.json';

function getModelConfigPath(): string {
  return path.join(process.cwd(), MODEL_CONFIG_FILENAME);
}

const qwenHandler = new QwenCodeHandler({});
const ollamaHandler = new OllamaCodeHandler({});

interface ModelEntry {
  id: string;
  name: string;
  baseUrl?: string;
  envKey?: string;
}

async function readProviderFromDisk(): Promise<ModelProvider | null> {
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as { provider?: string };
    if (parsed.provider === 'qwen' || parsed.provider === 'ollama' || parsed.provider === 'openai' || parsed.provider === 'openrouter' || parsed.provider === 'gemini') {
      return parsed.provider as ModelProvider;
    }
  } catch {
    // Ignore and fall back to in-memory default.
  }
  return null;
}

function isValidModelIdForProvider(
  config: { modelProviders?: Record<string, ModelEntry[]> },
  provider: ModelProvider,
  modelId: string,
): boolean {
  const list = config.modelProviders?.[provider];
  return Array.isArray(list) && list.some((m) => m.id === modelId);
}

/** Resolve which model entry to use for a provider (persisted modelId or first in list). */
export function resolveModelEntry(
  config: { modelProviders?: Record<string, ModelEntry[]> },
  provider: ModelProvider,
  modelId: string | null | undefined,
): ModelEntry | undefined {
  const list = config.modelProviders?.[provider];
  if (!Array.isArray(list) || list.length === 0) return undefined;
  if (modelId) {
    const found = list.find((m) => m.id === modelId);
    if (found) return found;
  }
  return list[0];
}

export async function getModelId(): Promise<string | null> {
  const provider = await getModelProvider();
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const config = JSON.parse(raw) as { modelId?: string; modelProviders?: Record<string, ModelEntry[]> };
    const mid = typeof config.modelId === 'string' ? config.modelId : null;
    if (mid && isValidModelIdForProvider(config, provider, mid)) {
      return mid;
    }
    const entry = resolveModelEntry(config, provider, null);
    return entry?.id ?? null;
  } catch {
    return null;
  }
}

export async function setModelProvider(provider: ModelProvider, modelId?: string): Promise<void> {
  currentProvider = provider;
  try {
    let config: any = {};
    try {
      const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
      config = JSON.parse(raw);
    } catch {
      // New config
    }

    config.provider = provider;
    const list: ModelEntry[] = config.modelProviders?.[provider] ?? [];
    let nextId = modelId;
    if (!nextId || !list.some((m) => m.id === nextId)) {
      nextId = list[0]?.id;
    }
    if (nextId) {
      config.modelId = nextId;
    } else {
      delete config.modelId;
    }
    const payload = JSON.stringify(config, null, 2);
    await fs.writeFile(getModelConfigPath(), payload, 'utf-8');
  } catch {
    // Best-effort only; ignore file write errors.
  }
}

export async function getModelProvider(): Promise<ModelProvider> {
  const disk = await readProviderFromDisk();
  if (disk) {
    currentProvider = disk;
  }
  return currentProvider;
}

export async function getModelLabel(): Promise<string> {
  const provider = await getModelProvider();
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const config = JSON.parse(raw);
    const modelId = await getModelId();
    const providerConfig = resolveModelEntry(config, provider, modelId);
    if (providerConfig && providerConfig.name) {
      return `${providerConfig.name} (${provider})`;
    }
  } catch {
    // Fallback if file read fails
  }

  if (provider === 'ollama') {
    return 'Ollama (local)';
  }
  if (provider === 'openai' || provider === 'openrouter') {
    return 'OpenAI Compatible';
  }
  if (provider === 'gemini') {
    return 'Gemini (Google)';
  }
  return 'Qwen (cloud)';
}

type CompletionHandler = {
  completePrompt: (userPrompt: string, systemPrompt?: string) => Promise<string>;
};

/** Shared model handler for agent step completion. */
async function getCompletionHandler(): Promise<CompletionHandler> {
  const provider = await getModelProvider();
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const config = JSON.parse(raw);
    const modelId = await getModelId();
    const providerConfig = resolveModelEntry(config, provider, modelId);

    if (provider === 'gemini') {
      return new GeminiHandler({
        baseUrl: providerConfig?.baseUrl,
        modelId: providerConfig?.id,
        envKey: providerConfig?.envKey,
      });
    }
    if (provider === 'openai' || provider === 'openrouter') {
      return new OpenAICompatibleHandler({
        baseUrl: providerConfig?.baseUrl,
        modelId: providerConfig?.id,
        envKey: providerConfig?.envKey,
      });
    }
    if (provider === 'ollama') {
      return new OllamaCodeHandler({
        baseUrl: providerConfig?.baseUrl,
        modelId: providerConfig?.id,
      });
    }
    return new QwenCodeHandler({
      modelId: providerConfig?.id,
      baseUrl: providerConfig?.baseUrl,
    });
  } catch {
    return provider === 'ollama' ? ollamaHandler : qwenHandler;
  }
}

export async function generateAgentStep(context: GenerateAgentStepContext): Promise<AgentStepResponse> {
  const { objective, history, tools, conversationHistory } = context;

  const toolsList = tools
    .map((tool) => `* ${tool.name}: ${tool.description}`)
    .join('\n');

  const historyJson = JSON.stringify(history ?? [], null, 2);
  const soulContext = getSoulContext();
  const identityContext = getIdentityContext();
  const userContext = getUserContext();
  const toolsContext = getToolsContext();
  const heartbeatContext = getHeartbeatContext();
  const skillNamesLine = getSkillDirectoryNamesLine();
  const skillsContext = getSkillsContext();

  const systemParts: string[] = [];
  if (soulContext) systemParts.push(soulContext);
  if (identityContext) systemParts.push(identityContext);
  if (userContext) systemParts.push(userContext);
  if (toolsContext) systemParts.push(toolsContext);
  if (heartbeatContext) systemParts.push(heartbeatContext);
  if (skillNamesLine) systemParts.push(skillNamesLine);
  const systemPrompt = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

  const promptParts: string[] = [];
  promptParts.push(getAgentStepPromptTemplate());

  if (skillsContext) {
    promptParts.push('', 'Additional skill documentation:', skillsContext);
  }

  // Include conversation history so the LLM understands prior context
  if (conversationHistory && conversationHistory.length > 0) {
    const convoLines = conversationHistory.map(
      (msg) => `[${msg.role}]: ${msg.content}`
    ).join('\n');
    promptParts.push(
      '',
      'Conversation history (previous messages between the user and assistant):',
      convoLines,
    );
  }

  promptParts.push(
    '',
    'Current objective:',
    objective,
    '',
    'Available tools for this task:',
    toolsList,
    '',
    'Previous steps (if any):',
    historyJson,
    '',
    'Decide the next action and respond with a single JSON object only.',
  );

  const userPrompt = promptParts.join('\n');
  const provider = await getModelProvider();
  const handler = await getCompletionHandler();

  console.log(`[llm] Using provider: ${provider}`);
  const rawResponse = await handler.completePrompt(userPrompt, systemPrompt);

  const parsed = safeParseJson(rawResponse);

  return {
    thought: typeof parsed.thought === 'string' ? parsed.thought : 'Model did not provide a thought.',
    action: typeof parsed.action === 'string' ? parsed.action : null,
    input: parsed.input,
    done: Boolean(parsed.done),
    final_answer: typeof parsed.final_answer === 'string' ? parsed.final_answer : undefined,
  };
}

/** Extract and parse model JSON robustly across provider formatting differences. */
function safeParseJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { thought: 'No JSON in response.', done: true, final_answer: 'No response.' };
  }

  const candidates = collectJsonCandidates(trimmed);
  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed) return parsed;
  }

  return {
    thought: 'Failed to parse model JSON response.',
    done: true,
    final_answer: trimmed.slice(0, 200),
  };
}

function collectJsonCandidates(raw: string): string[] {
  const out: string[] = [];

  // Prefer explicit JSON code blocks first (common across many providers).
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of raw.matchAll(codeBlockRegex)) {
    const block = match[1]?.trim();
    if (block) out.push(block);
  }

  // Fallback: scan for object-looking substrings in plain text response.
  out.push(...extractJsonLikeObjects(raw));
  out.push(raw);

  // Keep order while removing exact duplicates.
  return [...new Set(out)];
}

function extractJsonLikeObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  // If object is truncated, keep the partial as a recovery candidate.
  if (depth > 0 && start !== -1) {
    objects.push(text.slice(start));
  }

  return objects;
}

function parseJsonCandidate(candidate: string): Record<string, unknown> | null {
  const direct = tryParseJsonObject(candidate);
  if (direct) return direct;

  const repaired = tryParseJsonObject(repairTruncatedJson(candidate));
  if (repaired) return repaired;

  return null;
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  const normalized = normalizeJsonText(value);
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizeJsonText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^[`]+|[`]+$/g, '').trim();
}

function repairTruncatedJson(value: string): string {
  let text = normalizeJsonText(value);
  if (!text) return text;

  // If model appended text after a complete object, keep only object prefix.
  const completeObject = extractJsonLikeObjects(text).find((obj) => {
    const t = obj.trim();
    return t.startsWith('{') && t.endsWith('}');
  });
  if (completeObject) {
    return completeObject;
  }

  let inString = false;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (ch === '[') {
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }
  }

  if (inString) text += '"';
  text = text.replace(/,\s*([}\]])/g, '$1');
  if (bracketDepth > 0) text += ']'.repeat(bracketDepth);
  if (braceDepth > 0) text += '}'.repeat(braceDepth);

  return text;
}
const PROVIDER_LABELS: Record<string, string> = {
  qwen: 'Qwen',
  ollama: 'Ollama',
  gemini: 'Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

export async function getAllProvidersModels(): Promise<Record<string, Array<{ id: string; name: string }>>> {
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const config = JSON.parse(raw) as { modelProviders?: Record<string, ModelEntry[]> };
    const out: Record<string, Array<{ id: string; name: string }>> = {};
    for (const key of Object.keys(config.modelProviders || {})) {
      const list = config.modelProviders![key];
      if (!Array.isArray(list)) continue;
      out[key] = list.map((m) => ({ id: m.id, name: m.name }));
    }
    return out;
  } catch {
    return {};
  }
}

export async function getAvailableProviders(): Promise<Array<{ id: string; label: string }>> {
  try {
    const raw = await fs.readFile(getModelConfigPath(), 'utf-8');
    const config = JSON.parse(raw);
    const providers = Object.keys(config.modelProviders || {});
    if (providers.length === 0) {
      return [
        { id: 'qwen', label: 'Qwen' },
        { id: 'ollama', label: 'Ollama' },
        { id: 'gemini', label: 'Gemini' },
        { id: 'openrouter', label: 'OpenAI Compatible' },
      ];
    }
    return providers.map((p) => ({
      id: p,
      label: PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1),
    }));
  } catch {
    return [
      { id: 'qwen', label: 'Qwen' },
      { id: 'ollama', label: 'Ollama' },
      { id: 'gemini', label: 'Gemini' },
      { id: 'openai', label: 'OpenAI' },
      { id: 'openrouter', label: 'OpenRouter' },
    ];
  }
}
