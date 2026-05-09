# LLM Integration

TeleZero integrates with LLM providers through an OpenAI-compatible API, supporting OpenAI, Qwen, and any provider that implements the same interface.

## Overview

The LLM client is responsible for:
- **Constructing prompts** — Building structured prompts for the reasoning loop
- **API communication** — Sending requests to the LLM provider
- **Response parsing** — Parsing and validating JSON responses
- **Error handling** — Managing API failures gracefully

## Configuration

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `OPENAI_API_KEY` | API key for authentication | `sk-abc123...` |
| `OPENAI_BASE_URL` | API endpoint URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model identifier | `gpt-4` |

## Supported Providers

### OpenAI

```env
OPENAI_API_KEY=sk-your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
```

### Qwen (DashScope)

```env
OPENAI_API_KEY=your_dashscope_key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

### Any OpenAI-Compatible Provider

Set the `OPENAI_BASE_URL` to the provider's endpoint and configure the model name accordingly.

## LLM Client

**File**: `src/llm/llmClient.js`

### Key Function

```javascript
async function generateAgentStep(context)
```

**Input**: A context object containing:
- `objective` — The task goal
- `history` — Previous steps and results
- `availableTools` — List of tools the agent can use

**Output**: A parsed JSON object:
```javascript
{
  thought: "I should read the file first",
  action: "read_file",
  input: "/path/to/file.txt",
  done: false
}
```

### Implementation

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export async function generateAgentStep(context) {
  const prompt = buildPrompt(context);
  
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1000,
  });
  
  const content = response.choices[0].message.content;
  return parseJsonResponse(content);
}
```

## Prompt Engineering

### System Prompt

The system prompt establishes the agent's role and behavior guidelines:

```
You are an autonomous coding assistant.

You must decide the next action based on the objective and available tools.

Available tools:
- write_file(path, content): Write content to a file
- read_file(path): Read the contents of a file
- list_directory(path): List files in a directory
- run_command(command): Execute a shell command

Always respond in JSON format with the following structure:
{
  "thought": "Explain your reasoning",
  "action": "tool_name or null if done",
  "input": "tool parameters or null",
  "done": false
}

If the task is complete:
{
  "thought": "Explain what was accomplished",
  "done": true,
  "final_answer": "The final response to the user"
}
```

### Dynamic Prompt Construction

Each reasoning loop iteration builds a prompt that includes:
1. **Objective** — The original task goal
2. **Available tools** — Current tool list (includes dynamically loaded skills)
3. **Skill context** — SOUL.md content for relevant skills
4. **History** — Previous steps with actions taken and results

```
Objective: {objective}

Available tools: {tools}

Previous steps:
Step 1:
  Thought: {thought}
  Action: {action}
  Result: {result}

What is the next action?
```

## Response Parsing

The LLM response is parsed as JSON:

```javascript
function parseJsonResponse(content) {
  // Strip markdown code blocks if present
  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse LLM response as JSON: ${content}`);
  }
}
```

## Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| API timeout | Retry with exponential backoff |
| Rate limit (429) | Wait and retry after `Retry-After` header |
| Invalid JSON response | Log error and return structured error to agent |
| Authentication failure | Log critical error and halt |
| Model not found | Log error and halt |

## Performance Considerations

### Temperature

Set to `0.2` for deterministic, focused responses. Higher values increase creativity but reduce reliability for structured output.

### Max Tokens

Set to `1000` to allow sufficient reasoning space while controlling costs.

### Context Window

The prompt grows with each step as history accumulates. Monitor token usage and consider truncating old history if approaching limits.

## Cost Management

- **Step limit** — The 5-step max prevents excessive API calls per task
- **Model selection** — Use cheaper models for simple tasks, premium models for complex reasoning
- **Caching** — Consider caching common responses for repeated queries

## Testing

Test the LLM integration independently:

```bash
pnpm run agent
```

This runs a manual agent task that exercises the full LLM pipeline.

## Next Steps

- [Agent System](./agent-system.md) — How the LLM fits into the reasoning loop
- [Skills System](./skills-system.md) — How skills provide tool definitions to the LLM
