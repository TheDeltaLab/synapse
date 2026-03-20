import { createClient, type RedisClientType } from 'redis';

/**
 * Redis service singleton for caching LLM responses.
 * Gracefully degrades — never throws on connection or operation failures.
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
     * Non-blocking — logs errors but never throws.
     */
    async connect(): Promise<void> {
        const url = process.env.REDIS_URL;
        if (!url) {
            console.log('⚠️  REDIS_URL not set — caching disabled');
            return;
        }

        try {
            this.client = createClient({
                url,
                socket: {
                    reconnectStrategy(retries: number) {
                        if (retries > 3) return new Error('Max retries exceeded');
                        return Math.min(retries * 200, 2000);
                    },
                },
            });

            this.client.on('ready', () => {
                this.connected = true;
            });

            this.client.on('end', () => {
                this.connected = false;
            });

            this.client.on('error', (err: Error) => {
                console.error('Redis error:', err.message);
                this.connected = false;
            });

            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error instanceof Error ? error.message : error);
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
        } catch {
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
        } catch {
            // Silently fail — caching is best-effort
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
        } catch {
            // Silently fail
        }
    }
}

export const redisService = new RedisService();
