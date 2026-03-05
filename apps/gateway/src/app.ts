import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { loggerMiddleware } from './middleware/logger.js';
import { admin } from './routes/admin.js';
import { handleChatCompletion } from './routes/v1/chat.js';

const app = new Hono();

// Global middleware
app.use('*', loggerMiddleware);
app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-synapse-provider', 'x-synapse-response-style'],
}));

// Health check endpoint (no auth required)
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin routes (no auth for now)
app.route('/admin', admin);

// API routes with authentication
app.post('/v1/chat/completions', authMiddleware, handleChatCompletion);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not Found', message: 'Endpoint not found' }, 404);
});

// Error handler
app.onError(errorHandler);

export default app;
