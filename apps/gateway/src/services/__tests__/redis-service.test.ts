import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock methods that persist across createClient calls
const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockOn = vi.fn();

vi.mock('redis', () => {
    return {
        createClient: vi.fn(() => ({
            connect: mockConnect,
            close: mockClose,
            get: mockGet,
            set: mockSet,
            del: mockDel,
            on: mockOn,
        })),
    };
});

import { RedisService } from '../../services/redis-service.js';

describe('RedisService', () => {
    let service: RedisService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new RedisService();
    });

    afterEach(() => {
        delete process.env.REDIS_URL;
    });

    describe('connect', () => {
        it('should not connect when REDIS_URL is not set', async () => {
            delete process.env.REDIS_URL;
            await service.connect();
            expect(service.available).toBe(false);
        });

        it('should connect when REDIS_URL is set', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);

            // Simulate the 'ready' event being fired when on() is called
            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') {
                    cb();
                }
            });

            await service.connect();
            expect(mockConnect).toHaveBeenCalled();
            expect(service.available).toBe(true);
        });

        it('should handle connection failure gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockRejectedValue(new Error('Connection refused'));

            await service.connect();
            expect(service.available).toBe(false);
        });

        it('should set available to false on end event', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);

            let readyCb: (() => void) | undefined;
            let endCb: (() => void) | undefined;

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') readyCb = cb;
                if (event === 'end') endCb = cb;
            });

            await service.connect();
            readyCb?.();
            expect(service.available).toBe(true);

            endCb?.();
            expect(service.available).toBe(false);
        });

        it('should set available to false on error event', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);

            let readyCb: (() => void) | undefined;
            let errorCb: ((err: Error) => void) | undefined;

            mockOn.mockImplementation((event: string, cb: any) => {
                if (event === 'ready') readyCb = cb;
                if (event === 'error') errorCb = cb;
            });

            await service.connect();
            readyCb?.();
            expect(service.available).toBe(true);

            errorCb?.(new Error('Redis error'));
            expect(service.available).toBe(false);
        });
    });

    describe('disconnect', () => {
        it('should disconnect gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockClose.mockResolvedValue(undefined);

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await service.disconnect();
            expect(service.available).toBe(false);
            expect(mockClose).toHaveBeenCalled();
        });

        it('should handle disconnect when not connected', async () => {
            await service.disconnect();
            expect(service.available).toBe(false);
        });

        it('should handle disconnect errors gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockClose.mockRejectedValue(new Error('Close error'));

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await service.disconnect();
            expect(service.available).toBe(false);
        });
    });

    describe('get', () => {
        it('should return null when not connected', async () => {
            const result = await service.get('test-key');
            expect(result).toBeNull();
        });

        it('should return value on success', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockGet.mockResolvedValue('cached-value');

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            const result = await service.get('test-key');
            expect(result).toBe('cached-value');
            expect(mockGet).toHaveBeenCalledWith('test-key');
        });

        it('should return null on error', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockGet.mockRejectedValue(new Error('Get failed'));

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            const result = await service.get('test-key');
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should be a no-op when not connected', async () => {
            await service.set('key', 'value', 60);
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('should set value with TTL', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockSet.mockResolvedValue('OK');

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await service.set('key', 'value', 3600);
            expect(mockSet).toHaveBeenCalledWith('key', 'value', { EX: 3600 });
        });

        it('should set value without TTL', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockSet.mockResolvedValue('OK');

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await service.set('key', 'value');
            expect(mockSet).toHaveBeenCalledWith('key', 'value');
        });

        it('should handle set errors gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockSet.mockRejectedValue(new Error('Set failed'));

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            // Should not throw
            await expect(service.set('key', 'value')).resolves.toBeUndefined();
        });
    });

    describe('del', () => {
        it('should be a no-op when not connected', async () => {
            await service.del('key');
            expect(mockDel).not.toHaveBeenCalled();
        });

        it('should delete key on success', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockDel.mockResolvedValue(1);

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await service.del('key');
            expect(mockDel).toHaveBeenCalledWith('key');
        });

        it('should handle delete errors gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379';
            mockConnect.mockResolvedValue(undefined);
            mockDel.mockRejectedValue(new Error('Del failed'));

            mockOn.mockImplementation((event: string, cb: () => void) => {
                if (event === 'ready') cb();
            });

            await service.connect();
            await expect(service.del('key')).resolves.toBeUndefined();
        });
    });
});
