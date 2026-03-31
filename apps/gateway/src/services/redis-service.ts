import { DefaultAzureCredential } from '@azure/identity';
import { EntraIdCredentialsProviderFactory, REDIS_SCOPE_DEFAULT } from '@redis/entraid';
import { createClient, type RedisClientType } from 'redis';

/**
 * Redis service singleton for caching LLM responses.
 * Gracefully degrades — never throws on connection or operation failures.
 * Reconnects indefinitely with exponential backoff (max 60s).
 *
 * Supports Azure Entra ID authentication when REDIS_URL contains .redis.azure.net.
 */
export class RedisService {
    private client: RedisClientType | null = null;
    private connected = false;

    /**
     * Whether the Redis client is connected and ready for use.
     */
    get available(): boolean {
        return this.connected;
    }

    /**
     * Connect to Redis using the REDIS_URL environment variable.
     * When REDIS_URL contains .redis.azure.net, authenticates via Azure Entra ID
     * with automatic token refresh.
     * Non-blocking — logs errors but never throws.
     */
    async connect(): Promise<void> {
        const url = process.env.REDIS_URL;
        if (!url) {
            console.log('⚠️  REDIS_URL not set — caching disabled');
            return;
        }

        const useEntraId = url.includes('.redis.azure.net');

        try {
            const socketOptions = {
                reconnectStrategy(retries: number) {
                    const delay = Math.min(retries * 500, 60_000);
                    console.log(`[Redis] reconnecting attempt #${retries}, next retry in ${delay}ms`);
                    return delay;
                },
            };

            if (useEntraId) {
                const credential = new DefaultAzureCredential();
                const credentialsProvider = EntraIdCredentialsProviderFactory.createForDefaultAzureCredential({
                    credential,
                    scopes: REDIS_SCOPE_DEFAULT,
                    tokenManagerConfig: {
                        expirationRefreshRatio: 0.8,
                    },
                });

                this.client = createClient({
                    url,
                    credentialsProvider,
                    socket: socketOptions,
                });
                console.log('[Redis] using Azure Entra ID auth');
            } else {
                this.client = createClient({
                    url,
                    socket: socketOptions,
                });
            }

            this.client.on('ready', () => {
                this.connected = true;
                console.log('[Redis] connected');
            });

            this.client.on('end', () => {
                this.connected = false;
                console.log('[Redis] disconnected');
            });

            this.client.on('error', (err: Error) => {
                console.error('[Redis] error:', err.message);
                this.connected = false;
            });

            await this.client.connect();
        } catch (error) {
            console.error('[Redis] failed to connect:', error instanceof Error ? error.message : error);
            this.client = null;
            this.connected = false;
        }
    }

    /**
     * Disconnect from Redis.
     */
    async disconnect(): Promise<void> {
        try {
            if (this.client) {
                await this.client.close();
                this.client = null;
                this.connected = false;
            }
        } catch {
            // Ignore disconnect errors
            this.client = null;
            this.connected = false;
        }
    }

    /**
     * Get a value from Redis by key.
     * Returns null on miss or error.
     */
    async get(key: string): Promise<string | null> {
        try {
            if (!this.client || !this.connected) return null;
            return await this.client.get(key);
        } catch (err) {
            console.error('[Redis] GET error:', err instanceof Error ? err.message : err);
            return null;
        }
    }

    /**
     * Set a value in Redis with an optional TTL (in seconds).
     * No-op on error.
     */
    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        try {
            if (!this.client || !this.connected) return;
            if (ttlSeconds) {
                await this.client.set(key, value, { EX: ttlSeconds });
            } else {
                await this.client.set(key, value);
            }
        } catch (err) {
            console.error('[Redis] SET error:', err instanceof Error ? err.message : err);
        }
    }

    /**
     * Delete a key from Redis.
     * No-op on error.
     */
    async del(key: string): Promise<void> {
        try {
            if (!this.client || !this.connected) return;
            await this.client.del(key);
        } catch (err) {
            console.error('[Redis] DEL error:', err instanceof Error ? err.message : err);
        }
    }
}

export const redisService = new RedisService();
