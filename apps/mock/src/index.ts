import 'dotenv/config';
import { serve } from '@hono/node-server';
import { anthropicApp } from './providers/anthropic.js';
import { googleApp } from './providers/google.js';
import { openaiApp } from './providers/openai.js';
import { openrouterApp } from './providers/openrouter.js';

const OPENAI_PORT = parseInt(process.env.MOCK_OPENAI_PORT ?? '9001', 10);
const ANTHROPIC_PORT = parseInt(process.env.MOCK_ANTHROPIC_PORT ?? '9002', 10);
const GOOGLE_PORT = parseInt(process.env.MOCK_GOOGLE_PORT ?? '9003', 10);
const OPENROUTER_PORT = parseInt(process.env.MOCK_OPENROUTER_PORT ?? '9004', 10);

serve({ fetch: openaiApp.fetch, port: OPENAI_PORT }, () => {
    console.log(`Mock OpenAI     running on http://localhost:${OPENAI_PORT}`);
    console.log(`  GET  /health`);
    console.log(`  GET  /v1/models`);
    console.log(`  POST /v1/chat/completions  (501)`);
    console.log(`  POST /v1/embeddings`);
});

serve({ fetch: anthropicApp.fetch, port: ANTHROPIC_PORT }, () => {
    console.log(`Mock Anthropic  running on http://localhost:${ANTHROPIC_PORT}`);
    console.log(`  GET  /health`);
    console.log(`  POST /v1/messages          (501)`);
});

serve({ fetch: googleApp.fetch, port: GOOGLE_PORT }, () => {
    console.log(`Mock Google     running on http://localhost:${GOOGLE_PORT}`);
    console.log(`  GET  /health`);
    console.log(`  POST /v1beta/models/{model}:generateContent   (501)`);
    console.log(`  POST /v1beta/models/{model}:embedContent`);
    console.log(`  POST /v1beta/models/{model}:batchEmbedContents`);
});

serve({ fetch: openrouterApp.fetch, port: OPENROUTER_PORT }, () => {
    console.log(`Mock OpenRouter running on http://localhost:${OPENROUTER_PORT}`);
    console.log(`  GET  /health`);
    console.log(`  GET  /v1/models`);
    console.log(`  POST /v1/chat/completions  (501)`);
    console.log(`  POST /v1/embeddings`);
});
