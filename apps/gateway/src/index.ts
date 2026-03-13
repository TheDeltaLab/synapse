import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './app.js';
import { providerConfig, type ProviderName } from './config/providers.js';

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Gateway server starting on port ${port}...`);

serve({
    fetch: app.fetch,
    port,
});

console.log(`✅ Gateway server running at http://localhost:${port}`);
console.log(`   Health check: http://localhost:${port}/health`);
console.log(`   API endpoint: http://localhost:${port}/v1/chat/completions`);

// Log configured providers
const allProviders = Object.keys(providerConfig) as ProviderName[];
const chatProviders = allProviders.filter(name => providerConfig[name].apiKey);
const embeddingProviders = chatProviders.filter(name => providerConfig[name].embeddingModels.length > 0);

if (chatProviders.length > 0) {
    console.log(`\n📦 Chat providers (${chatProviders.length}):`);
    for (const name of chatProviders) {
        const config = providerConfig[name];
        console.log(`   ✔ ${name}  models: ${config.models.join(', ')}`);
    }
} else {
    console.log('\n⚠️  No chat providers configured. Set provider API keys in .env');
}

if (embeddingProviders.length > 0) {
    console.log(`\n🔢 Embedding providers (${embeddingProviders.length}):`);
    for (const name of embeddingProviders) {
        const config = providerConfig[name];
        console.log(`   ✔ ${name}  models: ${config.embeddingModels.join(', ')}`);
    }
} else {
    console.log('\n⚠️  No embedding providers configured.');
}
