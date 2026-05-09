# Agent System

The agent system is the core of TeleZero's intelligence. It implements an autonomous reasoning loop inspired by architectures like AutoGPT and OpenDevin, enabling multi-step task execution with tool use.

## Architecture

```
User Message
    ↓
┌─────────────────────┐
│  Agent Controller   │  ← Orchestrates task lifecycle
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│    Agent Task       │  ← Task state and history
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  Reasoning Loop     │  ← Core agent intelligence
└──────────┬──────────┘
           ↓
    ┌──────┴──────┐
    ↓             ↓
 LLM Client   Tools
```

## Agent Controller

**File**: `src/agent/agentController.js`

The Agent Controller is the main entry point for agent execution. It receives user messages, creates tasks, manages the reasoning loop, and returns responses.

### Key Function

```javascript
runTask({ userId, message })
```

Creates a new agent task and starts the reasoning loop. Returns the final response when the task completes.

### Responsibilities

- Receive user messages from the Telegram layer
- Create and initialize `AgentTask` instances
- Start and monitor the reasoning loop
- Handle errors and timeouts
- Return the final response to the caller

## Agent Task

**File**: `src/agent/agentTask.js`

An Agent Task defines the structure and state of a single agent execution.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique task identifier |
| `userId` | string | Telegram user ID |
| `objective` | string | The goal or request to accomplish |
| `history` | array | Record of all steps taken and results |
| `steps` | number | Current step count |
| `status` | string | `pending` / `running` / `completed` / `failed` |

### Example

```javascript
{
  id: "task_abc123",
  userId: "12345678",
  objective: "create a file in ~/sites with today's date",
  history: [],
  steps: 0,
  status: "pending"
}
```

## Reasoning Loop

**File**: `src/agent/reasoningLoop.js`

The reasoning loop is the core of the agent's intelligence. It iteratively decides the next action, executes tools, and builds up a history until the task is complete.

Completed runs optionally persist a markdown trace under **`src/workspace/context/`** (file names include a short session id and timestamp).

### Algorithm

```
loop until done OR max_steps reached:
  1. Build prompt with:
     - Objective
     - Previous steps and results
     - Available tools list
  2. Send prompt to LLM
  3. Parse structured JSON response
  4. If action exists:
     - Execute the tool
     - Record result in history
  5. If done = true:
     - Return final answer
  6. Increment step counter
```

### LLM Response Format

The LLM is instructed to respond in a strict JSON format:

**Action response** (continue working):

```json
{
  "thought": "I need to read the file first to check its contents",
  "action": "read_file",
  "input": "/path/to/file.txt",
  "done": false
}
```

**Completion response** (task finished):

```json
{
  "thought": "I have created the file successfully",
  "done": true,
  "final_answer": "The file has been created at /path/to/file.txt with today's date."
}
```

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_steps` | 5 | Maximum iterations before forced termination |
| `timeout_ms` | 60000 | Maximum time per LLM call |

## Agent Prompt Template

The reasoning loop uses a structured prompt template to guide the LLM:

```
You are an autonomous coding assistant.

Your objective: {objective}

Available tools:
- write_file(path, content): Write content to a file
- read_file(path): Read the contents of a file
- list_directory(path): List files in a directory
- run_command(command): Execute a shell command

Previous steps:
{history}

Decide the next action. Always respond in JSON format:

{
  "thought": "Explain your reasoning",
  "action": "tool_name",
  "input": "tool parameters",
  "done": false
}

If the task is complete, respond:

{
  "thought": "Explain what was accomplished",
  "done": true,
  "final_answer": "The final response to the user"
}
```

## LLM Client

**File**: `src/llm/llmClient.js`

The LLM client wraps the OpenAI-compatible API and provides the `generateAgentStep(context)` function used by the reasoning loop.

### Configuration

Environment variables:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for authentication |
| `OPENAI_BASE_URL` | API endpoint (supports any OpenAI-compatible provider) |
| `OPENAI_MODEL` | Model name to use (e.g., `gpt-4`, `qwen-turbo`) |

### Key Function

```javascript
generateAgentStep(context)
```

Sends the constructed prompt to the LLM and parses the JSON response. Returns the structured action or completion object.

## Execution Example

```
User: "Create a Python script that prints hello world"

Step 1:
  Thought: I need to create a Python file
  Action: write_file
  Input: { path: "hello.py", content: "print('hello world')" }

Step 2:
  Thought: Let me verify the file was created
  Action: read_file
  Input: "hello.py"

Step 3:
  Thought: Let me test it works
  Action: run_command
  Input: "python hello.py"

Step 4:
  Thought: Task is complete
  Done: true
  Final Answer: "Created hello.py and verified it prints 'hello world'"
```

## Extending the Agent

### Adding New Tools

1. Create a tool file in `src/tools/` or a skill directory in `src/skills/`
2. Export the tool with a name, schema, and execute function
3. The tool will be automatically discovered and registered

### Customizing the Prompt

Modify the prompt template in `reasoningLoop.js` to:
- Add new tool descriptions
- Change the response format
- Add constraints or guidelines

### Adjusting Limits

Change `max_steps` and `timeout_ms` in the reasoning loop configuration to allow longer or shorter task execution.

## Next Steps

- [Skills System](./skills-system.md) — Create dynamic skill modules
- [Tools](./development.md#tools) — Implement core and custom tools
- [LLM Integration](./llm-integration.md) — Configure LLM providers
