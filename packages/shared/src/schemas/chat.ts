import { z } from 'zod';

// Multi-modal content block schemas
export const textContentBlockSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});

export const audioContentBlockSchema = z.object({
    type: z.literal('input_audio'),
    input_audio: z.object({
        data: z.string(),
        format: z.enum(['wav', 'mp3', 'flac', 'ogg', 'pcm', 'm4a', 'aac', 'opus', 'wma']),
    }),
});

export const imageContentBlockSchema = z.object({
    type: z.literal('image_url'),
    image_url: z.object({
        url: z.string(),
        detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
    textContentBlockSchema,
    audioContentBlockSchema,
    imageContentBlockSchema,
]);

// Chat message schema
export const chatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant', 'function']),
    content: z.union([z.string(), z.array(contentBlockSchema)]),
    name: z.string().optional(),
});

// Chat completion request schema
export const chatCompletionRequestSchema = z.object({
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    n: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    stream_options: z.object({
        include_usage: z.boolean().optional(),
    }).optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().int().positive().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    user: z.string().optional(),
    modalities: z.array(z.enum(['text', 'audio'])).optional(),
});

// Retry configuration schema
export const retryConfigSchema = z.object({
    maxAttempts: z.number().int().min(1).max(5).default(3),
    backoff: z.enum(['exponential', 'linear', 'constant']).default('exponential'),
    retryOnStatusCodes: z.array(z.number().int()).default([429, 500, 502, 503]),
    fallbackProviders: z.array(z.string()).optional(),
});

// Cache configuration schema
export const cacheConfigSchema = z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().positive().default(3600), // 1 hour in seconds
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatCompletionRequestInput = z.infer<typeof chatCompletionRequestSchema>;
export type RetryConfig = z.infer<typeof retryConfigSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
