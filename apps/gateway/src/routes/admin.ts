import { Hono } from 'hono';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@synapse/dal';
import {
    createApiKeySchema,
    updateApiKeySchema,
    HTTP_STATUS,
    type ApiKeyResponse,
    type ApiKeyCreatedResponse,
    type ApiKeyListResponse,
} from '@synapse/shared';

const admin = new Hono();

// Helper to format API key response
const formatApiKeyResponse = (apiKey: {
    id: string;
    name: string;
    userId: string | null;
    rateLimit: number;
    enabled: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
}): ApiKeyResponse => ({
    id: apiKey.id,
    name: apiKey.name,
    userId: apiKey.userId,
    rateLimit: apiKey.rateLimit,
    enabled: apiKey.enabled,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
});

// Generate a secure API key
const generateApiKey = (): string => {
    const prefix = 'sk-syn';
    const randomPart = randomBytes(24).toString('base64url');
    return `${prefix}_${randomPart}`;
};

// List all API keys
admin.get('/api-keys', async (c) => {
    const apiKeys = await prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    const response: ApiKeyListResponse = {
        data: apiKeys.map(formatApiKeyResponse),
        total: apiKeys.length,
    };

    return c.json(response);
});

// Get single API key
admin.get('/api-keys/:id', async (c) => {
    const { id } = c.req.param();

    const apiKey = await prisma.apiKey.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    if (!apiKey) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND
        );
    }

    return c.json(formatApiKeyResponse(apiKey));
});

// Create new API key
admin.post('/api-keys', async (c) => {
    const body = await c.req.json();
    const parsed = createApiKeySchema.safeParse(body);

    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid request body',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST
        );
    }

    const { name, userId, rateLimit, expiresAt } = parsed.data;

    // Generate plaintext key and hash it
    const plaintextKey = generateApiKey();
    const hashedKey = await bcrypt.hash(plaintextKey, 10);

    const apiKey = await prisma.apiKey.create({
        data: {
            key: hashedKey,
            name,
            userId,
            rateLimit,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    const response: ApiKeyCreatedResponse = {
        ...formatApiKeyResponse(apiKey),
        key: plaintextKey, // Only returned on creation
    };

    return c.json(response, HTTP_STATUS.OK);
});

// Update API key
admin.patch('/api-keys/:id', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    const parsed = updateApiKeySchema.safeParse(body);

    if (!parsed.success) {
        return c.json(
            {
                error: 'Validation Error',
                message: 'Invalid request body',
                details: parsed.error.flatten().fieldErrors,
            },
            HTTP_STATUS.BAD_REQUEST
        );
    }

    // Check if key exists
    const existing = await prisma.apiKey.findUnique({
        where: { id },
    });

    if (!existing) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND
        );
    }

    const { name, rateLimit, enabled, expiresAt } = parsed.data;

    const apiKey = await prisma.apiKey.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(rateLimit !== undefined && { rateLimit }),
            ...(enabled !== undefined && { enabled }),
            ...(expiresAt !== undefined && {
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            }),
        },
        select: {
            id: true,
            name: true,
            userId: true,
            rateLimit: true,
            enabled: true,
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
        },
    });

    return c.json(formatApiKeyResponse(apiKey));
});

// Delete API key
admin.delete('/api-keys/:id', async (c) => {
    const { id } = c.req.param();

    // Check if key exists
    const existing = await prisma.apiKey.findUnique({
        where: { id },
    });

    if (!existing) {
        return c.json(
            { error: 'Not Found', message: 'API key not found' },
            HTTP_STATUS.NOT_FOUND
        );
    }

    await prisma.apiKey.delete({
        where: { id },
    });

    return c.json({ message: 'API key deleted successfully' });
});

export { admin };
