import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app.js';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Gateway server starting on port ${port}...`);

serve({
    fetch: app.fetch,
    port,
});

console.log(`✅ Gateway server running at http://localhost:${port}`);
console.log(`   Health check: http://localhost:${port}/health`);
console.log(`   API endpoint: http://localhost:${port}/v1/chat/completions`);
