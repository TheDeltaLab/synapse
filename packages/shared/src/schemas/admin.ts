import { z } from 'zod';

// API Key schemas
export const createApiKeySchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    userId: z.string().optional(),
    rateLimit: z.number().int().positive().optional().default(1000),
    expiresAt: z.string().datetime().optional(),
});

export const updateApiKeySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    rateLimit: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
});

export const apiKeyResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    userId: z.string().nullable(),
    rateLimit: z.number(),
    enabled: z.boolean(),
    lastUsedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
});

export const apiKeyCreatedResponseSchema = apiKeyResponseSchema.extend({
    key: z.string(), // Plaintext key, only returned on creation
});

export const apiKeyListResponseSchema = z.object({
    data: z.array(apiKeyResponseSchema),
    total: z.number(),
});

// Type exports
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;
export type ApiKeyCreatedResponse = z.infer<typeof apiKeyCreatedResponseSchema>;
export type ApiKeyListResponse = z.infer<typeof apiKeyListResponseSchema>;

// Provider schemas
export const responseStyleSchema = z.enum(['openai', 'anthropic', 'google']);

export const providerInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    available: z.boolean(),
    chatModels: z.array(z.string()),
    defaultChatModel: z.string().optional(),
    embeddingModels: z.array(z.string()),
    defaultEmbeddingModel: z.string().nullable(),
    responseStyles: z.array(responseStyleSchema),
    defaultResponseStyle: responseStyleSchema,
});

export const providersResponseSchema = z.object({
    providers: z.array(providerInfoSchema),
});

export type ProviderInfo = z.infer<typeof providerInfoSchema>;
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;
