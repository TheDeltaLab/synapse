/**
 * Random vector generation utilities for mock embedding endpoints.
 */

/** Default embedding dimensions per model. */
export const DIMENSIONS: Record<string, number> = {
    // OpenAI models
    'text-embedding-3-small': 1536,
    'text-embedding-3-large': 3072,
    'text-embedding-ada-002': 1536,

    // Google models
    'text-embedding-004': 768,
    'embedding-001': 768,
};

/** Default dimension when model is not found in DIMENSIONS map. */
const DEFAULT_DIMENSION = 1536;

/**
 * Resolve the embedding dimension for a model.
 * An explicit `requestedDimension` overrides the model default.
 */
export function getDimension(model: string, requestedDimension?: number): number {
    if (requestedDimension !== undefined && requestedDimension > 0) {
        return requestedDimension;
    }
    return DIMENSIONS[model] ?? DEFAULT_DIMENSION;
}

/**
 * Generate a random L2-normalized float vector of the given dimension.
 */
export function generateRandomVector(dimension: number): number[] {
    const vector: number[] = [];
    let sumSquares = 0;

    for (let i = 0; i < dimension; i++) {
        // Generate random values using Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const value = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        vector.push(value);
        sumSquares += value * value;
    }

    // L2 normalize
    const magnitude = Math.sqrt(sumSquares);
    if (magnitude > 0) {
        for (let i = 0; i < dimension; i++) {
            vector[i] = vector[i]! / magnitude;
        }
    }

    return vector;
}
