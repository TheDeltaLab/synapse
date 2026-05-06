import type { Context, Next } from 'hono';
import { HTTP_STATUS } from '@synapse/shared';
import { resolveResponseStyle } from '../adapters/index.js';
import { authService, type ValidatedApiKey } from '../services/auth-service.js';

// Extend Hono context with custom variables
declare module 'hono' {
    interface ContextVariableMap {
        apiKey: ValidatedApiKey;
    }
}

export async function authMiddleware(c: Context, next: Next) {
    if (process.env.AUTH_DISABLED === 'true') {
        c.set('apiKey', {
            id: 'auth-disabled',
            name: 'auth-disabled',
            userId: null,
            rateLimit: Infinity,
        });
        return next();
    }

    // Pick which header carries the synapse api-key based on the resolved
    // response style: anthropic-style clients send x-api-key (Anthropic SDK
    // convention); openai/google-style clients send Authorization: Bearer.
    const providerHeader = c.req.header('x-synapse-provider') ?? '';
    const styleHeader = c.req.header('x-synapse-response-style');
    const style = resolveResponseStyle(providerHeader, styleHeader);

    let token: string | undefined;
    // if anthropic-style, look for x-api-key header
    if (style === 'anthropic') {
        token = c.req.header('x-api-key');
    }
    // openai format or fallback to openai-style
    if (token === undefined) {
        const authHeader = c.req.header('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        return c.json({
            error: 'Unauthorized',
            message: `Missing API key header (response style: ${style})`,
        }, HTTP_STATUS.UNAUTHORIZED);
    }

    try {
        const validatedKey = await authService.validateApiKey(token);

        if (!validatedKey) {
            return c.json({
                error: 'Unauthorized',
                message: 'Invalid or expired API key',
            }, HTTP_STATUS.UNAUTHORIZED);
        }

        // Check rate limit
        const withinLimit = await authService.checkRateLimit(
            validatedKey.id,
            validatedKey.rateLimit,
        );

        if (!withinLimit) {
            return c.json({
                error: 'Rate Limit Exceeded',
                message: `You have exceeded your rate limit of ${validatedKey.rateLimit} requests per hour`,
            }, HTTP_STATUS.TOO_MANY_REQUESTS);
        }

        // Attach validated key to context
        c.set('apiKey', validatedKey);

        await next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return c.json({
            error: 'Internal Server Error',
            message: 'Authentication failed',
        }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
}
