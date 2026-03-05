import crypto from 'crypto';
import type { ChatMessage } from '../types/chat.js';

/**
 * Generate a cache key for a chat completion request
 * Format: cache:v1:{provider}:{model}:{hash(messages)}
 */
export function generateCacheKey(
    provider: string,
    model: string,
    messages: ChatMessage[],
): string {
    const messagesStr = JSON.stringify(messages);
    const hash = crypto.createHash('sha256').update(messagesStr).digest('hex').substring(0, 16);
    return `cache:v1:${provider}:${model}:${hash}`;
}

/**
 * Simple delay function for retry backoff
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, baseDelay = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}
