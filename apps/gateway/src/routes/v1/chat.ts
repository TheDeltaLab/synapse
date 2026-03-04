import type { Context } from 'hono';
import { streamText } from 'ai';
import { chatCompletionRequestSchema, HTTP_STATUS } from '@synapse/shared';
import { providerRegistry } from '@synapse/services/provider-registry.js';
import { prisma } from '@synapse/dal';
import type { ProviderName } from '@synapse/config/providers.js';

export async function handleChatCompletion(c: Context) {
    try {
        // Parse and validate request body
        const body = await c.req.json();
        const parseResult = chatCompletionRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json({
                error: 'Bad Request',
                message: 'Invalid request format',
                details: parseResult.error.errors,
            }, HTTP_STATUS.BAD_REQUEST);
        }

        const request = parseResult.data;
        const apiKey = c.get('apiKey');

        // Determine provider from model or use default
        const provider = determineProvider(request.model);
        const modelId = request.model;

        // Check if provider is available
        if (!providerRegistry.hasProvider(provider)) {
            return c.json({
                error: 'Bad Request',
                message: `Provider ${provider} is not configured`,
            }, HTTP_STATUS.BAD_REQUEST);
        }

        const startTime = Date.now();

        // Get the model instance
        const model = providerRegistry.getModel(provider, modelId);

        // Handle streaming response
        if (request.stream) {
            const result = streamText({
                model,
                messages: request.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
                temperature: request.temperature,
                maxTokens: request.max_tokens,
                topP: request.top_p,
            });

            // Log request
            logRequest(apiKey.id, provider, modelId, 200, false, Date.now() - startTime);

            return result.toDataStreamResponse();
        }

        // Handle non-streaming response
        const result = await streamText({
            model,
            messages: request.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            temperature: request.temperature,
            maxTokens: request.max_tokens,
            topP: request.top_p,
        });

        const text = await result.text;
        const usage = await result.usage;
        const latency = Date.now() - startTime;

        // Log request
        await logRequest(
            apiKey.id,
            provider,
            modelId,
            200,
            false,
            latency,
            usage.totalTokens
        );

        // Return OpenAI-compatible response
        return c.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: modelId,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: text,
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: usage.promptTokens,
                completion_tokens: usage.completionTokens,
                total_tokens: usage.totalTokens,
            },
        });
    } catch (error) {
        console.error('Chat completion error:', error);
        return c.json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to process request',
        }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Determine provider from model name
 */
function determineProvider(model: string): ProviderName {
    if (model.startsWith('gpt-') || model.includes('openai')) {
        return 'openai';
    }
    if (model.startsWith('claude-') || model.includes('anthropic')) {
        return 'anthropic';
    }
    if (model.startsWith('gemini-') || model.includes('google')) {
        return 'google';
    }
    // Default to openai
    return 'openai';
}

/**
 * Log request to database
 */
async function logRequest(
    apiKeyId: string,
    provider: string,
    model: string,
    statusCode: number,
    cached: boolean,
    latency: number,
    tokens?: number
): Promise<void> {
    try {
        await prisma.requestLog.create({
            data: {
                apiKeyId,
                provider,
                model,
                statusCode,
                cached,
                latency,
                tokens: tokens || null,
            },
        });
    } catch (error) {
        console.error('Failed to log request:', error);
    }
}
