import { promises as fs } from "node:fs"
import OpenAI from "openai"
import * as os from "os"
import * as path from "path"

const QWEN_DEFAULT_MODEL = "qwen3-coder-plus"; // qwen3-coder-flash or qwen3-coder-plus
const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai"
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const QWEN_DIR = ".qwen"
const QWEN_CREDENTIAL_FILENAME = "oauth_creds.json"

interface QwenOAuthCredentials {
	access_token: string
	refresh_token: string
	token_type: string
	expiry_date: number
	resource_url?: string
}

export interface QwenCodeHandlerOptions {
	qwenCodeOauthPath?: string
	modelId?: string
	baseUrl?: string
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

function getQwenCachedCredentialPath(customPath?: string): string {
	if (customPath) {
		// Support custom path that starts with ~/ or is absolute
		if (customPath.startsWith("~/")) {
			return path.join(os.homedir(), customPath.slice(2))
		}
		return path.resolve(customPath)
	}
	return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME)
}

function objectToUrlEncoded(data: Record<string, string>): string {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join("&")
}

export class QwenCodeHandler {
	private options: QwenCodeHandlerOptions
	private credentials: QwenOAuthCredentials | null = null
	private client: OpenAI | undefined
	private refreshPromise: Promise<QwenOAuthCredentials> | null = null

	constructor(options: QwenCodeHandlerOptions = {}) {
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			// Create the client instance with dummy key initially
			// The API key will be updated dynamically via ensureAuthenticated
			this.client = new OpenAI({
				apiKey: "dummy-key-will-be-replaced",
				baseURL: this.options.baseUrl || "https://portal.qwen.ai/v1",
				defaultHeaders: {
					"User-Agent": "QwenCode/1.0.0 (darwin; arm64)",
					"X-DashScope-CacheControl": "enable",
					"X-DashScope-UserAgent": "QwenCode/1.0.0 (darwin; arm64)",
					"X-DashScope-AuthType": "qwen-oauth",
				},
			})
		}
		return this.client
	}

	private async loadCachedQwenCredentials(): Promise<QwenOAuthCredentials> {
		try {
			const keyFile = getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)
			const credsStr = await fs.readFile(keyFile, "utf-8")
			return JSON.parse(credsStr)
		} catch (error) {
			console.error(
				`Error reading or parsing credentials file at ${getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)}`,
			)
			throw new Error(`Failed to load Qwen OAuth credentials: ${error}`)
		}
	}

	private async refreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		// If a refresh is already in progress, return the existing promise
		if (this.refreshPromise) {
			return this.refreshPromise
		}

		// Create a new refresh promise
		this.refreshPromise = this.doRefreshAccessToken(credentials)

		try {
			const result = await this.refreshPromise
			return result
		} finally {
			// Clear the promise after completion (success or failure)
			this.refreshPromise = null
		}
	}

	private async doRefreshAccessToken(credentials: QwenOAuthCredentials): Promise<QwenOAuthCredentials> {
		if (!credentials.refresh_token) {
			throw new Error("No refresh token available in credentials.")
		}

		const bodyData = {
			grant_type: "refresh_token",
			refresh_token: credentials.refresh_token,
			client_id: QWEN_OAUTH_CLIENT_ID,
		}

		const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: objectToUrlEncoded(bodyData),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`)
		}

		const tokenData = await response.json()

		if (tokenData.error) {
			throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`)
		}

		const newCredentials = {
			...credentials,
			access_token: tokenData.access_token,
			token_type: tokenData.token_type,
			refresh_token: tokenData.refresh_token || credentials.refresh_token,
			expiry_date: Date.now() + tokenData.expires_in * 1000,
		}

		const filePath = getQwenCachedCredentialPath(this.options.qwenCodeOauthPath)
		try {
			await fs.writeFile(filePath, JSON.stringify(newCredentials, null, 2))
		} catch (error) {
			console.error("Failed to save refreshed credentials:", error)
			// Continue with the refreshed token in memory even if file write fails
		}

		return newCredentials
	}

	private isTokenValid(credentials: QwenOAuthCredentials): boolean {
		const TOKEN_REFRESH_BUFFER_MS = 30 * 1000 // 30s buffer
		if (!credentials.expiry_date) {
			return false
		}
		return Date.now() < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.credentials) {
			this.credentials = await this.loadCachedQwenCredentials()
		}

		if (!this.isTokenValid(this.credentials)) {
			this.credentials = await this.refreshAccessToken(this.credentials)
		}

		// After authentication, update the apiKey and baseURL on the existing client
		const client = this.ensureClient()
		client.apiKey = this.credentials.access_token
		client.baseURL = this.getBaseUrl(this.credentials)
	}

	private getBaseUrl(creds: QwenOAuthCredentials): string {

		// temporary
		return `https://coder.ronaldaug.workers.dev/v1`;

		// let baseUrl = creds.resource_url || "https://portal.qwen.ai/v1"
		// if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
		// 	baseUrl = `https://${baseUrl}`
		// }
		// return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`
	}

	private async callApiWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
		try {
			return await apiCall()
		} catch (error: any) {
			if (error.status === 401) {
				// Token expired, refresh and retry
				this.credentials = await this.refreshAccessToken(this.credentials!)
				const client = this.ensureClient()
				client.apiKey = '142020aghllm'
				client.baseURL = this.getBaseUrl(this.credentials)
				return await apiCall()
			} else {
				throw error
			}
		}
	}

	async *createMessage(
		systemPrompt: string,
		messages: Array<{ role: string; content: string }>,
		tools?: Tool[],
	): AsyncGenerator<StreamChunk> {
		await this.ensureAuthenticated()
		const client = this.ensureClient()
		const modelId = this.options.modelId ?? QWEN_DEFAULT_MODEL

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...messages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			})),
		]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: 0,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
		}

		// Add tools if provided
		if (tools && tools.length > 0) {
			(requestOptions as any).tools = tools
		}

		const stream = await this.callApiWithRetry(() => client.chat.completions.create(requestOptions))

		let fullContent = ""

		for await (const apiChunk of stream) {
			const delta = apiChunk.choices[0]?.delta ?? {}

			if (delta.content) {
				let newText = delta.content
				if (newText.startsWith(fullContent)) {
					newText = newText.substring(fullContent.length)
				}
				fullContent = delta.content

				if (newText) {
					// Check for thinking blocks
					if (newText.includes("<think>") || newText.includes("</think>")) {
						const parts = newText.split(/<\/?think>/g)
						for (let i = 0; i < parts.length; i++) {
							if (parts[i]) {
								yield {
									type: i % 2 === 0 ? "text" : "reasoning",
									text: parts[i],
								}
							}
						}
					} else {
						yield { type: "text", text: newText }
					}
				}
			}

			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (apiChunk.usage) {
				yield {
					type: "usage",
					inputTokens: apiChunk.usage.prompt_tokens || 0,
					outputTokens: apiChunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	async completePrompt(userPrompt: string, systemPrompt?: string): Promise<string> {
		await this.ensureAuthenticated()
		const client = this.ensureClient()
		const modelId = this.options.modelId ?? QWEN_DEFAULT_MODEL

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
		if (systemPrompt && systemPrompt.trim() !== "") {
			messages.push({ role: "system", content: systemPrompt })
		}
		messages.push({ role: "user", content: userPrompt })

		const response = await this.callApiWithRetry(() =>
			client.chat.completions.create({
				model: modelId,
				messages,
				temperature: 0.2,
				top_p: 0.95
			}),
		)

		return response.choices[0]?.message.content || ""
	}

	async callWithTools(
		systemPrompt: string,
		messages: Array<{ role: string; content: string }>,
		tools: Tool[],
		toolExecutor: (toolName: string, toolArgs: any) => Promise<any>,
		maxIterations: number = 10,
	): Promise<string> {
		await this.ensureAuthenticated()
		const client = this.ensureClient()
		const modelId = this.options.modelId ?? QWEN_DEFAULT_MODEL

		const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...messages.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			})),
		]

		for (let iteration = 0; iteration < maxIterations; iteration++) {
			const response = await this.callApiWithRetry(() =>
				client.chat.completions.create({
					model: modelId,
					messages: conversationMessages,
					temperature: 0,
					tools: tools.length > 0 ? tools : undefined,
				} as any),
			)

			const message = response.choices[0]?.message
			if (!message) break

			// If there's text content, add it to the conversation
			if (message.content) {
				conversationMessages.push({
					role: "assistant",
					content: message.content,
				})
			}

			// Check if the model wants to call a tool
			const toolCalls = (message as any).tool_calls
			if (!toolCalls || toolCalls.length === 0) {
				// No tool calls, we're done
				return message.content || ""
			}

			// Execute all tool calls
			const toolResults: Array<{
				tool_call_id: string
				content: string
			}> = []

			for (const toolCall of toolCalls) {
				if (toolCall.type !== "function") continue

				try {
					const result = await toolExecutor(toolCall.function.name, JSON.parse(toolCall.function.arguments))
					toolResults.push({
						tool_call_id: toolCall.id,
						content: JSON.stringify(result),
					})
				} catch (error: any) {
					toolResults.push({
						tool_call_id: toolCall.id,
						content: JSON.stringify({ error: error.message }),
					})
				}
			}

			// Add tool results to conversation
			for (const result of toolResults) {
				conversationMessages.push({
					role: "user",
					content: `[Tool Result - ${result.tool_call_id}]\n${result.content}`,
				})
			}
		}

		return "Assistant did not provide a final response within the maximum iterations."
	}
}