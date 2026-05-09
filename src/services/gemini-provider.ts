import OpenAI from "openai"

const GEMINI_DEFAULT_MODEL = "gemini-3-flash-preview"
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

export interface GeminiHandlerOptions {
    baseUrl?: string
    modelId?: string
    apiKey?: string
    envKey?: string
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

export class GeminiHandler {
    private options: GeminiHandlerOptions
    private client: OpenAI

    constructor(options: GeminiHandlerOptions = {}) {
        this.options = options
        const apiKey = options.apiKey || (options.envKey ? process.env[options.envKey] : process.env.GEMINI_API_KEY) || ""

        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: options.baseUrl || GEMINI_BASE_URL,
        })
    }

    async completePrompt(userPrompt: string, systemPrompt?: string): Promise<string> {
        const modelId = this.options.modelId ?? GEMINI_DEFAULT_MODEL
        try {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
            if (systemPrompt && systemPrompt.trim() !== "") {
                messages.push({ role: "system", content: systemPrompt })
            }
            messages.push({ role: "user", content: userPrompt })
            const response = await this.client.chat.completions.create({
                model: modelId,
                messages,
                temperature: 0.2,
                stream: false,
            });

            if (response && response.choices && response.choices.length > 0) {
                return response.choices[0].message?.content || "";
            }

            console.warn("[GeminiHandler] Unexpected response structure:", response);
            return typeof response === 'string' ? response : JSON.stringify(response);

        } catch (error: any) {
            // Log full error details from the API response
            const status = error?.status ?? error?.statusCode ?? 'unknown';
            const errorBody = error?.error ?? error?.response?.data ?? error?.body ?? null;
            const headers = error?.headers ? Object.fromEntries(Object.entries(error.headers)) : null;
            console.error(`[GeminiHandler] completePrompt error: status=${status} message=${error.message}`);
            console.error(`[GeminiHandler] error body:`, JSON.stringify(errorBody, null, 2));
            console.error(`[GeminiHandler] model=${modelId} baseURL=${this.client.baseURL}`);
            if (headers) {
                console.error(`[GeminiHandler] response headers:`, JSON.stringify(headers, null, 2));
            }
            throw error;
        }
    }

    async *createMessage(
        systemPrompt: string,
        messages: Array<{ role: string; content: string }>,
        tools?: Tool[],
    ): AsyncGenerator<StreamChunk> {
        const modelId = this.options.modelId ?? GEMINI_DEFAULT_MODEL;

        const openAiMessages: any[] = [];
        if (systemPrompt) {
            openAiMessages.push({ role: "system", content: systemPrompt });
        }
        for (const m of messages) {
            openAiMessages.push({ role: m.role, content: m.content });
        }

        const stream = await this.client.chat.completions.create({
            model: modelId,
            messages: openAiMessages,
            temperature: 0,
            stream: true,
            ...(tools && tools.length > 0 ? { tools: tools as any } : {})
        });

        for await (const chunk of stream) {
            if (!chunk.choices || chunk.choices.length === 0) continue;

            const delta = chunk.choices[0].delta as any;

            if (delta.content) {
                yield { type: "text", text: delta.content };
            }

            if (chunk.usage) {
                yield {
                    type: "usage",
                    inputTokens: chunk.usage.prompt_tokens || 0,
                    outputTokens: chunk.usage.completion_tokens || 0,
                };
            }

            // Check for finish_reason to know stream is done
            if (chunk.choices[0].finish_reason === "stop") {
                break;
            }
        }
    }

    async callWithTools(
        systemPrompt: string,
        messages: Array<{ role: string; content: string }>,
        tools: Tool[],
        toolExecutor: (toolName: string, toolArgs: any) => Promise<any>,
        maxIterations: number = 10,
    ): Promise<string> {
        const modelId = this.options.modelId ?? GEMINI_DEFAULT_MODEL

        const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemPrompt && systemPrompt.trim() !== "") {
            conversationMessages.push({ role: "system", content: systemPrompt })
        }

        for (const m of messages) {
            conversationMessages.push({
                role: m.role as "user" | "assistant",
                content: m.content,
            })
        }

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            const response = await this.client.chat.completions.create({
                model: modelId,
                messages: conversationMessages,
                temperature: 0,
                tools: tools.length > 0 ? (tools as any) : undefined,
                stream: false
            } as any)

            const message = response.choices[0]?.message
            if (!message) break

            conversationMessages.push(message)

            const toolCalls = message.tool_calls
            if (!toolCalls || toolCalls.length === 0) {
                return message.content || ""
            }

            for (const toolCall of toolCalls) {
                if (toolCall.type !== 'function') continue

                try {
                    const result = await toolExecutor(toolCall.function.name, JSON.parse(toolCall.function.arguments))
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(result),
                    })
                } catch (error: any) {
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: error.message }),
                    })
                }
            }
        }

        return "Assistant did not provide a final response within the maximum iterations."
    }
}
