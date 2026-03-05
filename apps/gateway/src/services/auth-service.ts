import bcrypt from 'bcrypt';
import { prisma } from '@synapse/dal';

export interface ValidatedApiKey {
    id: string;
    name: string;
    userId: string | null;
    rateLimit: number;
}

export class AuthService {
    /**
     * Validate an API key and return key details
     */
    async validateApiKey(keyPlaintext: string): Promise<ValidatedApiKey | null> {
        // Find all API keys (we need to check bcrypt hash)
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                enabled: true,
            },
            select: {
                id: true,
                key: true,
                name: true,
                userId: true,
                rateLimit: true,
                expiresAt: true,
            },
        });

        // Check each key's hash
        for (const apiKey of apiKeys) {
            const isMatch = await bcrypt.compare(keyPlaintext, apiKey.key);

            if (isMatch) {
                // Check if key is expired
                if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
                    return null;
                }

                // Update last used timestamp
                await prisma.apiKey.update({
                    where: { id: apiKey.id },
                    data: { lastUsedAt: new Date() },
                });

                return {
                    id: apiKey.id,
                    name: apiKey.name,
                    userId: apiKey.userId,
                    rateLimit: apiKey.rateLimit,
                };
            }
        }

        return null;
    }

    /**
     * Check rate limit for an API key
     * Returns true if within limits, false if exceeded
     */
    async checkRateLimit(apiKeyId: string, rateLimit: number): Promise<boolean> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const requestCount = await prisma.requestLog.count({
            where: {
                apiKeyId,
                createdAt: {
                    gte: oneHourAgo,
                },
            },
        });

        return requestCount < rateLimit;
    }
}

export const authService = new AuthService();
