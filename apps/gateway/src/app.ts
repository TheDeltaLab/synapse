import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { loggerMiddleware } from './middleware/logger.js';
import { admin } from './routes/admin.js';
import { handleProxy } from './routes/v1/proxy.js';
import { redisService } from './services/redis-service.js';

const app = new Hono();

// Global middleware
app.use('*', loggerMiddleware);
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-synapse-provider', 'x-synapse-response-style'],
}));

// Health check endpoint (no auth required)
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        cache: {
            enabled: redisService.available,
            provider: 'redis',
        },
    });
});

// Admin routes (no auth for now)
app.route('/admin', admin);

// Transparent proxy: forward all other requests to upstream providers
app.all('/*', authMiddleware, handleProxy);

// Error handler
app.onError(errorHandler);

export default app;
