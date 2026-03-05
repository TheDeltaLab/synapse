import type { Context } from 'hono';
import { streamText } from 'ai';
import { chatCompletionRequestSchema, HTTP_STATUS, type CacheType } from '@synapse/shared';
import { providerRegistry } from '@synapse/services/provider-registry.js';
import { prisma, encryptContent, isEncryptionConfigured } from '@synapse/dal';
import type { ProviderName } from '@synapse/config/providers.js';
import { getAdapter } from '../../adapters/index.js';

interface LogRequestParams {
    apiKeyId: string;
    provider: string;
    model: string;
    statusCode: number;
    latency: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    promptMessages?: Array<{ role: string; content: string }>;
    responseContent?: string;
    cached?: boolean;
    cacheType?: CacheType;
    cacheTtl?: number;
    costSaving?: number;
    latencySaving?: number;
}

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

        // Use provider from x-synapse-provider header, or fall back to determining from model name
        const providerHeader = c.req.header('x-synapse-provider');
        const provider = (providerHeader as ProviderName) || determineProvider(request.model);
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

            // Get the streaming adapter based on x-synapse-response-style header
            const responseStyle = c.req.header('x-synapse-response-style') || 'openai';
            const adapter = getAdapter(responseStyle);

            // Create SSE stream using the adapter
            const chatId = `chatcmpl-${Date.now()}`;
            const created = Math.floor(Date.now() / 1000);
            const encoder = new TextEncoder();

            const metadata = {
                id: chatId,
                model: modelId,
                created,
                index: 0,
            };

            // Use TransformStream to convert text chunks to SSE format
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            // Collect response for logging
            let fullResponse = '';

            // Process stream in background
            (async () => {
                try {
                    for await (const chunk of result.textStream) {
                        fullResponse += chunk;
                        const formatted = adapter.formatChunk(chunk, metadata);
                        await writer.write(encoder.encode(formatted));
                    }

                    // Send final chunk with finish_reason
                    await writer.write(encoder.encode(adapter.formatFinalChunk(metadata)));
                    await writer.write(encoder.encode(adapter.formatDone()));

                    // Log request after stream completes
                    const usage = await result.usage;
                    const latency = Date.now() - startTime;
                    logRequest({
                        apiKeyId: apiKey.id,
                        provider,
                        model: modelId,
                        statusCode: 200,
                        latency,
                        inputTokens: usage.promptTokens,
                        outputTokens: usage.completionTokens,
                        totalTokens: usage.totalTokens,
                        promptMessages: request.messages.map(msg => ({
                            role: msg.role,
                            content: msg.content,
                        })),
                        responseContent: fullResponse,
                        cached: false,
                    });
                } catch (error) {
                    console.error('Stream processing error:', error);
                    // Try to send error to client
                    try {
                        const errorData = {
                            error: {
                                message: error instanceof Error ? error.message : 'Stream error',
                                type: 'stream_error',
                            },
                        };
                        await writer.write(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
                    } catch {
                        // Ignore write errors
                    }
                } finally {
                    try {
                        await writer.close();
                    } catch {
                        // Ignore close errors
                    }
                }
            })();

            return new Response(readable, {
                headers: adapter.getResponseHeaders(),
            });
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

        // Log request with detailed data
        await logRequest({
            apiKeyId: apiKey.id,
            provider,
            model: modelId,
            statusCode: 200,
            latency,
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            promptMessages: request.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            responseContent: text,
            cached: false,
        });

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
async function logRequest(params: LogRequestParams): Promise<void> {
    try {
        // Encrypt content if encryption is configured
        const encryptedContent = isEncryptionConfigured()
            ? encryptContent(params.promptMessages, params.responseContent)
            : { promptContent: null, responseContent: null, contentIv: null, contentTag: null };

        await prisma.requestLog.create({
            data: {
                apiKeyId: params.apiKeyId,
                provider: params.provider,
                model: params.model,
                statusCode: params.statusCode,
                latency: params.latency,
                inputTokens: params.inputTokens ?? null,
                outputTokens: params.outputTokens ?? null,
                totalTokens: params.totalTokens ?? null,
                promptContent: encryptedContent.promptContent,
                responseContent: encryptedContent.responseContent,
                contentIv: encryptedContent.contentIv,
                contentTag: encryptedContent.contentTag,
                cached: params.cached ?? false,
                cacheType: params.cacheType ?? null,
                cacheTtl: params.cacheTtl ?? null,
                costSaving: params.costSaving ?? null,
                latencySaving: params.latencySaving ?? null,
            },
        });
    } catch (error) {
        console.error('Failed to log request:', error);
    }
}
