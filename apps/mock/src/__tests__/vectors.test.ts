import { describe, it, expect } from 'vitest';
import { generateRandomVector, getDimension, DIMENSIONS } from '../utils/vectors.js';

describe('generateRandomVector', () => {
    it('should return a vector of the specified dimension', () => {
        const vector = generateRandomVector(128);
        expect(vector).toHaveLength(128);
    });

    it('should return a vector of dimension 1', () => {
        const vector = generateRandomVector(1);
        expect(vector).toHaveLength(1);
    });

    it('should return an L2-normalized vector (magnitude ≈ 1)', () => {
        const vector = generateRandomVector(256);
        const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should produce different vectors on successive calls', () => {
        const v1 = generateRandomVector(64);
        const v2 = generateRandomVector(64);
        // Extremely unlikely to be identical
        expect(v1).not.toEqual(v2);
    });

    it('should contain only finite numbers', () => {
        const vector = generateRandomVector(512);
        for (const v of vector) {
            expect(Number.isFinite(v)).toBe(true);
        }
    });
});

describe('getDimension', () => {
    it('should return model default dimension when no override', () => {
        expect(getDimension('text-embedding-3-small')).toBe(1536);
        expect(getDimension('text-embedding-3-large')).toBe(3072);
    });

    it('should return 1536 for unknown models', () => {
        expect(getDimension('unknown-model')).toBe(1536);
    });

    it('should respect requested dimension override', () => {
        expect(getDimension('text-embedding-3-small', 256)).toBe(256);
    });

    it('should ignore zero or negative requested dimension', () => {
        expect(getDimension('text-embedding-3-small', 0)).toBe(1536);
        expect(getDimension('text-embedding-3-small', -1)).toBe(1536);
    });
});

describe('DIMENSIONS', () => {
    it('should have entries for known OpenAI models', () => {
        expect(DIMENSIONS['text-embedding-3-small']).toBe(1536);
        expect(DIMENSIONS['text-embedding-3-large']).toBe(3072);
        expect(DIMENSIONS['text-embedding-ada-002']).toBe(1536);
    });

    it('should have entries for known Google models', () => {
        expect(DIMENSIONS['text-embedding-004']).toBe(768);
        expect(DIMENSIONS['embedding-001']).toBe(768);
    });
});
