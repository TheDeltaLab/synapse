// Re-export schema-inferred types for convenience
export type {
    CreateApiKeyInput,
    UpdateApiKeyInput,
    ApiKeyResponse,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    ProviderInfo,
    ProvidersResponse,
} from '../schemas/admin.js';

// Additional admin-related types
export interface AdminErrorResponse {
    error: string;
    message: string;
    details?: Record<string, string[]>;
}
