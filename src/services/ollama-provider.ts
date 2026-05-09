export interface OllamaCodeHandlerOptions {
	baseUrl?: string
	modelId?: string
}

export interface StreamChunk {
	type: "text" | "reasoning" | "usage"
	text?: string
	inputTokens?: number
	outputTokens?: number
}

export interface Tool {
	type: "function"
	function: {
		name: string
		description: string
		parameters: Record<string, any>
	}
}

interface OllamaChatMessage {
	role: "system" | "user" | "assistant"
	content: string
}

interface OllamaStreamResponseChunk {
	model?: string
	created_at?: string
	message?: {
		role: "assistant"
		content: string
	}
	done?: boolean
	eval_count?: number
	prompt_eval_count?: number
}

interface OllamaNonStreamResponse {
	model: string
	created_at: string
	message: {
		role: "assistant"
		content: string
	}
	done: boolean
	eval_count?: number
	prompt_eval_count?: number
}

export class OllamaCodeHandler {
	private options: OllamaCodeHandlerOptions

	constructor(options: OllamaCodeHandlerOptions = {}) {
		this.options = options
	}

	private get baseUrl(): string {
		return this.options.baseUrl ?? "http://localhost:11434"
	}

	private get modelId(): string {
		return this.options.modelId ?? "qwen-local-4b"
	}

	/**
	 * Streaming chat-style API similar to QwenCodeHandler.createMessage.
	 * Uses Ollama's /api/chat streaming endpoint.
	 */
	async *createMessage(
		systemPrompt: string,
		messages: Array<{ role: string; content: string }>,
		_tools?: Tool[],
	): AsyncGenerator<StreamChunk> {
		const ollamaMessages: OllamaChatMessage[] = []

		if (systemPrompt) {
			ollamaMessages.push({ role: "system", content: systemPrompt })
		}

		for (const msg of messages) {
			const role = msg.role === "assistant" ? "assistant" : "user"
			ollamaMessages.push({ role, content: msg.content })
		}

		const response = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.modelId,
				messages: ollamaMessages,
				stream: true,
			}),
		})

		if (!response.ok || !response.body) {
			throw new Error(`Ollama chat request failed: ${response.status} ${response.statusText}`)
		}

		const reader = response.body.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		let totalPromptTokens = 0
		let totalCompletionTokens = 0

		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })

			let newlineIndex: number
			while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
				const line = buffer.slice(0, newlineIndex).trim()
				buffer = buffer.slice(newlineIndex + 1)

				if (!line) continue

				let parsed: OllamaStreamResponseChunk
				try {
					parsed = JSON.parse(line) as OllamaStreamResponseChunk
				} catch {
					continue
				}

				if (typeof parsed.prompt_eval_count === "number") {
					totalPromptTokens = parsed.prompt_eval_count
				}
				if (typeof parsed.eval_count === "number") {
					totalCompletionTokens = parsed.eval_count
				}

				const content = parsed.message?.content ?? ""
				if (content) {
					yield {
						type: "text",
						text: content,
					}
				}

				if (parsed.done) {
					if (totalPromptTokens || totalCompletionTokens) {
						yield {
							type: "usage",
							inputTokens: totalPromptTokens,
							outputTokens: totalCompletionTokens,
						}
					}
				}
			}
		}
	}

	/**
	 * Simple non-streaming prompt completion helper.
	 */
	async completePrompt(userPrompt: string, systemPrompt?: string): Promise<string> {
        console.log('Using Ollama!!!!!');
		const messages: Array<{ role: string; content: string }> = []
		if (systemPrompt && systemPrompt.trim() !== "") {
			messages.push({ role: "system", content: systemPrompt })
		}
		messages.push({ role: "user", content: userPrompt })
		const response = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.modelId,
				messages,
				stream: false,
			}),
		})

		if (!response.ok) {
			const text = await response.text().catch(() => "")
			throw new Error(`Ollama completePrompt failed: ${response.status} ${response.statusText} ${text}`)
		}

		const data = (await response.json()) as OllamaNonStreamResponse
		return data.message?.content ?? ""
	}

	/**
	 * Basic tools loop implementation.
	 * This is a lightweight, model-agnostic wrapper that expects the model
	 * to output JSON describing tool usage, not native tool calls.
	 */
	async callWithTools(
		systemPrompt: string,
		messages: Array<{ role: string; content: string }>,
		_tools: Tool[],
		_toolExecutor: (toolName: string, toolArgs: any) => Promise<any>,
		_maxIterations: number = 10,
	): Promise<string> {
		// For now, just fall back to a single non-tool call chat completion.
		const parts: string[] = []
		if (systemPrompt) {
			parts.push(systemPrompt, "")
		}
		for (const m of messages) {
			parts.push(`${m.role.toUpperCase()}: ${m.content}`)
		}
		const prompt = parts.join("\n")
		return this.completePrompt(prompt)
	}
}

