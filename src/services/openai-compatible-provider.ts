import OpenAI from "openai"

export interface OpenAICompatibleHandlerOptions {
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

export class OpenAICompatibleHandler {
    private options: OpenAICompatibleHandlerOptions
    private client: OpenAI

    constructor(options: OpenAICompatibleHandlerOptions = {}) {
        this.options = options
        const apiKey = options.apiKey || (options.envKey ? process.env[options.envKey] : process.env.OPENAI_API_KEY) || "tgicodesecret"

        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: options.baseUrl,
        })
    }

    async completePrompt(userPrompt: string, systemPrompt?: string): Promise<string> {
        const modelId = this.options.modelId ?? "glm-4.7-flash"
        try {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
            if (systemPrompt && systemPrompt.trim() !== "") {
                messages.push({ role: "system", content: systemPrompt })
            }
            messages.push({ role: "user", content: userPrompt })
            // Some providers (e.g. Cloudflare Workers AI) may ignore stream:false
            // and return SSE anyway. Use streaming and accumulate the result to be safe.
            const stream = await this.client.chat.completions.create({
                model: modelId,
                messages,
                temperature: 0.2,
                stream: true,
            });

            let result = "";
            for await (const chunk of stream) {
                if (!chunk.choices || chunk.choices.length === 0) continue;
                const delta = chunk.choices[0].delta as any;
                if (delta?.content) {
                    result += delta.content;
                }
            }

            return result || "";

        } catch (error: any) {
            console.error(`[OpenAICompatibleHandler] completePrompt error: ${error.message}`);
            throw error;
        }
    }

    async *createMessage(
        systemPrompt: string,
        messages: Array<{ role: string; content: string }>,
        tools?: Tool[],
    ): AsyncGenerator<StreamChunk> {
        const modelId = this.options.modelId ?? "glm-4.7-flash";
        
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

            // 1. Handle standard content
            if (delta.content) {
                yield { type: "text", text: delta.content };
            }

            // 2. Handle GLM's specific reasoning field
            // Note: Cloudflare often uses 'reasoning' or 'reasoning_content'
            const reasoning = delta.reasoning || delta.reasoning_content;
            if (reasoning) {
                yield { type: "reasoning", text: reasoning };
            }

            if (chunk.usage) {
                yield {
                    type: "usage",
                    inputTokens: chunk.usage.prompt_tokens || 0,
                    outputTokens: chunk.usage.completion_tokens || 0,
                };
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
        const modelId = this.options.modelId ?? "glm-4.7-flash"

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
            // Fix: Strip options here too
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