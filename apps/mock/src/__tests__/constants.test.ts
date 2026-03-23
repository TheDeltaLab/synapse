import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MOCK_RESPONSE_TEXT constant', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        // Reset module registry so re-imports pick up the new env
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('should return the default value when env var is not set', async () => {
        delete process.env.MOCK_RESPONSE_TEXT;
        const { MOCK_RESPONSE_TEXT } = await import('../utils/constants.js');
        expect(MOCK_RESPONSE_TEXT).toBe('this is a mock response from LLM');
    });

    it('should return the env var value when set', async () => {
        process.env.MOCK_RESPONSE_TEXT = 'custom mock response';
        const { MOCK_RESPONSE_TEXT } = await import('../utils/constants.js');
        expect(MOCK_RESPONSE_TEXT).toBe('custom mock response');
    });

    it('should return the default value when env var is empty string', async () => {
        process.env.MOCK_RESPONSE_TEXT = '';
        const { MOCK_RESPONSE_TEXT } = await import('../utils/constants.js');
        expect(MOCK_RESPONSE_TEXT).toBe('this is a mock response from LLM');
    });
});
