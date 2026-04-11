import { startOtelSdk } from '@synapse/observability/nodeSdk';
startOtelSdk({ serviceName: 'synapse-gateway', enableConsolePatch: true });

import 'dotenv/config';
// eslint-disable-next-line import/order
import { serve } from '@hono/node-server';
import app from './app.js';
import { providers, getChatDeployments, getEmbeddingDeployments } from './config/providers.js';
import { redisService } from './services/redis-service.js';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Gateway server starting on port ${port}...`);

const server = serve({
    fetch: app.fetch,
    port,
});

console.log(`✅ Gateway server running at http://localhost:${port}`);
console.log(`   Health check: http://localhost:${port}/health`);
console.log(`   API endpoint: http://localhost:${port}/v1/chat/completions`);

// Connect to Redis for caching (non-blocking)
redisService.connect().then(() => {
    if (redisService.available) {
        console.log('\n🗄️  Redis connected — LLM response caching enabled');
    } else {
        console.log('\n⚠️  Redis not available — LLM response caching disabled');
    }
});

// Log configured providers
const configuredProviders = providers.filter(provider => provider.getApiKey());
const chatProviders = configuredProviders.filter(provider => getChatDeployments(provider.id).length > 0);
const embeddingProviders = configuredProviders.filter(provider => getEmbeddingDeployments(provider.id).length > 0);

if (chatProviders.length > 0) {
    console.log(`\n📦 Chat providers (${chatProviders.length}):`);
    for (const provider of chatProviders) {
        const modelIds = getChatDeployments(provider.id).map(deployment => deployment.modelId);
        console.log(`   ✔ ${provider.id}  models: ${modelIds.join(', ')}`);
    }
} else {
    console.log('\n⚠️  No chat providers configured. Set provider API keys in .env');
}

if (embeddingProviders.length > 0) {
    console.log(`\n🔢 Embedding providers (${embeddingProviders.length}):`);
    for (const provider of embeddingProviders) {
        const modelIds = getEmbeddingDeployments(provider.id).map(deployment => deployment.modelId);
        console.log(`   ✔ ${provider.id}  models: ${modelIds.join(', ')}`);
    }
} else {
    console.log('\n⚠️  No embedding providers configured.');
}

// Graceful shutdown
function shutdown() {
    console.log('\nShutting down gateway server...');
    server.close(async () => {
        await redisService.disconnect();
        console.log('Gateway server stopped.');
        process.exit(0);
    });
    // Force exit after 5 seconds if server hasn't closed
    setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
