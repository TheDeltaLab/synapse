import { AnthropicAdapter } from './anthropic-adapter.js';
import { GoogleAdapter } from './google-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import type { StreamingAdapter } from './types.js';

// Re-export types and adapters
export type { ChunkMetadata, StreamingAdapter } from './types.js';
export { OpenAIAdapter } from './openai-adapter.js';
export { AnthropicAdapter } from './anthropic-adapter.js';
export { GoogleAdapter } from './google-adapter.js';

/**
 * Registry of streaming adapters by style name
 */
const adapters = new Map<string, StreamingAdapter>();
adapters.set('openai', new OpenAIAdapter());
adapters.set('anthropic', new AnthropicAdapter());
adapters.set('google', new GoogleAdapter());

/**
 * Get a streaming adapter by style name
 * @param style - The adapter style ('openai', 'anthropic', 'google')
 * @returns The streaming adapter, defaults to OpenAI if style not found
 */
export function getAdapter(style: string): StreamingAdapter {
    return adapters.get(style.toLowerCase()) || adapters.get('openai')!;
}

/**
 * Get all available adapter styles
 * @returns Array of available style names
 */
export function getAvailableStyles(): string[] {
    return Array.from(adapters.keys());
}
