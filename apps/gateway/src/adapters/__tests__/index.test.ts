import { describe, expect, it } from 'vitest';
import { getProviderAdapter, resolveResponseStyle } from '../index.js';

describe('getProviderAdapter', () => {
    it('should return openai adapter for openai provider', () => {
        const adapter = getProviderAdapter('openai');
        expect(adapter.style).toBe('openai');
    });

    it('should return openai adapter for openrouter provider', () => {
        const adapter = getProviderAdapter('openrouter');
        expect(adapter.style).toBe('openai');
    });

    it('should return openai adapter for deepseek provider', () => {
        const adapter = getProviderAdapter('deepseek');
        expect(adapter.style).toBe('openai');
    });

    it('should return openai adapter for alibaba provider', () => {
        const adapter = getProviderAdapter('alibaba');
        expect(adapter.style).toBe('openai');
    });

    it('should return anthropic adapter for anthropic provider', () => {
        const adapter = getProviderAdapter('anthropic');
        expect(adapter.style).toBe('anthropic');
    });

    it('should return google adapter for google provider', () => {
        const adapter = getProviderAdapter('google');
        expect(adapter.style).toBe('google');
    });

    it('should use header override when provided', () => {
        const adapter = getProviderAdapter('openai', 'anthropic');
        expect(adapter.style).toBe('anthropic');
    });

    it('should handle case-insensitive header override', () => {
        const adapter = getProviderAdapter('openai', 'Anthropic');
        expect(adapter.style).toBe('anthropic');
    });

    it('should ignore invalid header override', () => {
        const adapter = getProviderAdapter('anthropic', 'invalid-style');
        expect(adapter.style).toBe('anthropic');
    });

    it('should fallback to openai for unknown provider', () => {
        const adapter = getProviderAdapter('unknown-provider');
        expect(adapter.style).toBe('openai');
    });
});

describe('resolveResponseStyle', () => {
    it('honors header override over provider default', () => {
        expect(resolveResponseStyle('deepseek', 'anthropic')).toBe('anthropic');
    });

    it('falls back to provider default when header is absent', () => {
        expect(resolveResponseStyle('deepseek')).toBe('openai');
        expect(resolveResponseStyle('anthropic')).toBe('anthropic');
        expect(resolveResponseStyle('google')).toBe('google');
    });

    it('ignores invalid header override and falls back to provider default', () => {
        expect(resolveResponseStyle('deepseek', 'bogus')).toBe('openai');
    });

    it('defaults to openai for unknown provider with no header', () => {
        expect(resolveResponseStyle('')).toBe('openai');
        expect(resolveResponseStyle('mystery')).toBe('openai');
    });
});
