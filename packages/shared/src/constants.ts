// Supported LLM providers
export const SUPPORTED_PROVIDERS = [
    'openai',
    'anthropic',
    'google',
    'deepseek',
] as const;

export type Provider = typeof SUPPORTED_PROVIDERS[number];

// Default rate limits
export const DEFAULT_RATE_LIMIT = 1000; // requests per hour
export const DEFAULT_CACHE_TTL = 3600; // 1 hour in seconds
export const DEFAULT_MAX_RETRIES = 3;

// HTTP status codes
export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
} as const;
