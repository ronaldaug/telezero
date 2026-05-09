import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';

const ROOT = process.cwd();
const SRC_WORKSPACE = join(ROOT, 'src', 'workspace');
const DIST_WORKSPACE = join(ROOT, 'dist', 'workspace');

/**
 * Prefer src/workspace if it exists (live updates during dev), 
 * otherwise fallback to dist/workspace (production).
 */
function getWorkspacePath(filename: string): string {
  const src = join(SRC_WORKSPACE, filename);
  if (existsSync(src)) return src;
  return join(DIST_WORKSPACE, filename);
}

const SKILLS_DIR = getWorkspacePath('skills');
const SOUL_PATH = getWorkspacePath('SOUL.md');
const IDENTITY_PATH = getWorkspacePath('IDENTITY.md');
const USER_PATH = getWorkspacePath('USER.md');
const TOOLS_PATH = getWorkspacePath('TOOLS.md');
const HEARTBEAT_PATH = getWorkspacePath('HEARTBEAT.md');

/** Optional override: absolute path or path relative to process.cwd() */
function getAgentStepPromptPath(): string {
  const fromEnv = process.env.TELEZERO_AGENT_STEP_PATH?.trim();
  if (fromEnv) {
    return isAbsolute(fromEnv) ? fromEnv : join(ROOT, fromEnv);
  }
  return getWorkspacePath('AGENT_STEP.md');
}

/** Used only if AGENT_STEP.md is missing or unreadable (keeps the agent usable). */
const DEFAULT_AGENT_STEP_PROMPT = `
Your identity is **TeleZero**. Who you are, which skill modules exist, and global rules are defined in the system message when the host provides one—follow that first.

You must decide the next action.

Available tools:

* write_file - Write text content to a file on disk. Expects an object: { "path": "string", "content": "string" }.
* read_file - Read text content from a file on disk. Expects an object: { "path": "string" }.
* list_directory - List files and subdirectories in a directory. Expects an object: { "path": "string" }.
* run_command - Run a shell command on the server. Expects an object: { "command": "string" }. Use this for APIs (e.g. Notion: curl with NOTION_KEY from ~/.config/notion/api_key).

Always respond with exactly ONE JSON object. No other text before or after.

To perform a tool call:
{
  "thought": "brief reason",
  "action": "tool_name",
  "input": { ... },
  "done": false
}

When the task is fully complete, respond with:
{
  "thought": "brief summary of what was done",
  "done": true,
  "final_answer": "One or two short sentences in plain language for the user. Example: I've added your note to Notion. Never put JSON or thought/action here."
}

RULES:
1. When "done" is true, you MUST ALWAYS include a non-empty "final_answer" string. Never omit it.
2. "final_answer" must be plain, human-readable text only. Never output JSON, never include "thought", "action", or "input" in final_answer.
3. If the user asks who you are, your capabilities, or your skills, answer DIRECTLY from the system message and skill documentation.
    - Identify as TeleZero and list the registered skill module names from the system message (and details from skill docs below).
    - Do NOT answer with a generic "autonomous coding assistant" or similar boilerplate.
    - Do NOT use a tool call — set "done": true and put the answer in "final_answer".
`.trim();

/**
 * Agent step instructions (JSON tool protocol, identity hints) loaded from
 * src/workspace/AGENT_STEP.md, or TELEZERO_AGENT_STEP_PATH, with a built-in fallback
 * if the file is missing.
 */
export function getAgentStepPromptTemplate(): string {
  const path = getAgentStepPromptPath();
  if (!existsSync(path)) {
    console.warn(
      `AGENT_STEP prompt file not found at ${path}; using built-in default. Set TELEZERO_AGENT_STEP_PATH or add src/workspace/AGENT_STEP.md.`,
    );
    return DEFAULT_AGENT_STEP_PROMPT;
  }
  try {
    const text = readFileSync(path, 'utf-8').trim();
    if (!text) {
      console.warn(`AGENT_STEP prompt file is empty (${path}); using built-in default.`);
      return DEFAULT_AGENT_STEP_PROMPT;
    }
    return text;
  } catch (err) {
    console.error(`Failed to load agent step prompt from ${path}:`, err);
    return DEFAULT_AGENT_STEP_PROMPT;
  }
}

export interface SkillDoc {
  name: string;
  content: string;
}

/**
 * Load SOUL.md (system/identity prompt) from src/workspace/SOUL.md.
 * Used at the start of the agent prompt so the model adopts TeleZero's identity and rules.
 */
export function getSoulContext(): string {
  if (!existsSync(SOUL_PATH)) return '';
  try {
    return readFileSync(SOUL_PATH, 'utf-8').trim();
  } catch (err) {
    console.error('Failed to load SOUL.md:', err);
    return '';
  }
}

/**
 * Load IDENTITY.md (voice, persona, and behavioral traits) from src/workspace/IDENTITY.md.
 */
export function getIdentityContext(): string {
  if (!existsSync(IDENTITY_PATH)) return '';
  try {
    return readFileSync(IDENTITY_PATH, 'utf-8').trim();
  } catch (err) {
    console.error('Failed to load IDENTITY.md:', err);
    return '';
  }
}

/**
 * Load USER.md (user-specific context, learned preferences, and profile) from src/workspace/USER.md.
 */
export function getUserContext(): string {
  if (!existsSync(USER_PATH)) return '';
  try {
    return readFileSync(USER_PATH, 'utf-8').trim();
  } catch (err) {
    console.error('Failed to load USER.md:', err);
    return '';
  }
}

/**
 * Load TOOLS.md (capability manifest and skills directory instructions) from src/workspace/TOOLS.md.
 */
export function getToolsContext(): string {
  if (!existsSync(TOOLS_PATH)) return '';
  try {
    return readFileSync(TOOLS_PATH, 'utf-8').trim();
  } catch (err) {
    console.error('Failed to load TOOLS.md:', err);
    return '';
  }
}

/**
 * Load HEARTBEAT.md (real-time state monitoring and pulse instructions) from src/workspace/HEARTBEAT.md.
 */
export function getHeartbeatContext(): string {
  if (!existsSync(HEARTBEAT_PATH)) return '';
  try {
    return readFileSync(HEARTBEAT_PATH, 'utf-8').trim();
  } catch (err) {
    console.error('Failed to load HEARTBEAT.md:', err);
    return '';
  }
}

function resolveSkillDocPath(skillDirName: string): string | null {
  const soul = join(SKILLS_DIR, skillDirName, 'SOUL.md');
  if (existsSync(soul)) return soul;
  const skillLegacy = join(SKILLS_DIR, skillDirName, 'SKILL.md');
  if (existsSync(skillLegacy)) return skillLegacy;
  return null;
}

/**
 * Load per-skill markdown from src/workspace/skills/<name>/SOUL.md
 * (fallback: SKILL.md for older setups). These are injected so the model can answer
 * questions like "what are your skills?" from project truth, not generic training data.
 */
export function loadAgentContext(): SkillDoc[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const docs: SkillDoc[] = [];

  for (const dir of dirs) {
    const path = resolveSkillDocPath(dir);
    if (!path) continue;

    try {
      const content = readFileSync(path, 'utf-8');
      docs.push({ name: dir, content });
    } catch (err) {
      console.error(`Failed to load skill doc ${dir}:`, err);
    }
  }

  return docs;
}

/**
 * Concatenate all skill docs into one string for inclusion in the agent prompt.
 * Also lists skill directories that exist but have no doc file so the LLM
 * knows the full set of registered skills.
 */
export function getSkillsContext(): string {
  if (!existsSync(SKILLS_DIR)) return '';

  const allDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'template' && !d.name.startsWith('.'))
    .map((d) => d.name);

  if (allDirs.length === 0) return '';

  const docs = loadAgentContext();
  const documentedNames = new Set(docs.map((d) => d.name));

  const parts: string[] = [];

  for (const d of docs) {
    parts.push(`## Skill: ${d.name}\n\n${d.content.trim()}`);
  }

  // List undocumented skill directories so the LLM knows they exist
  const undocumented = allDirs.filter((name) => !documentedNames.has(name));
  if (undocumented.length > 0) {
    parts.push(
      `## Other registered skills (no documentation file yet)\n\n${undocumented.map((n) => `- ${n}`).join('\n')}`,
    );
  }

  return `\n\n# Your skills — this is the COMPLETE list of your registered skills. When asked "what are your skills?", list ALL of these:\n\n${parts.join(
    '\n\n---\n\n',
  )}`;
}

/**
 * Comma-separated skill folder names (excluding `context`) so the model can answer
 * "what are your skills?" even when some folders lack SKILL.md/SOUL.md.
 */
export function getSkillDirectoryNamesLine(): string {
  if (!existsSync(SKILLS_DIR)) return '';

  const names = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'template' && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  if (names.length === 0) return '';
  return `Registered TeleZero skill modules (use these names when listing your skills): ${names.join(', ')}.`;
}

