import type {
    ApiKeyResponse,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    CreateApiKeyInput,
    UpdateApiKeyInput,
    ProvidersResponse,
    RequestLogListResponse,
    RequestLogDetail,
    AnalyticsResponse,
    LogsQuery,
    AnalyticsQuery,
    EmbeddingLogsQuery,
    EmbeddingLogListResponse,
    EmbeddingLogItem,
    EmbeddingAnalyticsResponse,
} from '@synapse/shared';

// Use relative paths - requests go through Next.js API routes which proxy to the gateway
// This avoids CORS issues and keeps the gateway URL server-side only
const API_BASE = '/api';

class GatewayClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    // API Keys
    async listApiKeys(): Promise<ApiKeyListResponse> {
        const response = await fetch(`${this.baseUrl}/admin/api-keys`);
        if (!response.ok) {
            throw new Error(`Failed to list API keys: ${response.statusText}`);
        }
        return response.json();
    }

    async getApiKey(id: string): Promise<ApiKeyResponse> {
        const response = await fetch(`${this.baseUrl}/admin/api-keys/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to get API key: ${response.statusText}`);
        }
        return response.json();
    }

    async createApiKey(data: CreateApiKeyInput): Promise<ApiKeyCreatedResponse> {
        const response = await fetch(`${this.baseUrl}/admin/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create API key');
        }
        return response.json();
    }

    async updateApiKey(id: string, data: UpdateApiKeyInput): Promise<ApiKeyResponse> {
        const response = await fetch(`${this.baseUrl}/admin/api-keys/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update API key');
        }
        return response.json();
    }

    async deleteApiKey(id: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/admin/api-keys/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error(`Failed to delete API key: ${response.statusText}`);
        }
    }

    // Providers
    async getProviders(): Promise<ProvidersResponse> {
        const response = await fetch(`${this.baseUrl}/admin/providers`);
        if (!response.ok) {
            throw new Error(`Failed to fetch providers: ${response.statusText}`);
        }
        return response.json();
    }

    // Logs
    async listLogs(query?: Partial<LogsQuery>): Promise<RequestLogListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.set('page', query.page.toString());
        if (query?.limit) params.set('limit', query.limit.toString());
        if (query?.provider) params.set('provider', query.provider);
        if (query?.model) params.set('model', query.model);
        if (query?.cached !== undefined) params.set('cached', query.cached);
        if (query?.startDate) params.set('startDate', query.startDate);
        if (query?.endDate) params.set('endDate', query.endDate);
        if (query?.apiKeyId) params.set('apiKeyId', query.apiKeyId);

        const url = `${this.baseUrl}/admin/logs${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to list logs: ${response.statusText}`);
        }
        return response.json();
    }

    async getLog(id: string): Promise<RequestLogDetail> {
        const response = await fetch(`${this.baseUrl}/admin/logs/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to get log: ${response.statusText}`);
        }
        return response.json();
    }

    async getAnalytics(query?: Partial<AnalyticsQuery>): Promise<AnalyticsResponse> {
        const params = new URLSearchParams();
        if (query?.range) params.set('range', query.range);

        const url = `${this.baseUrl}/admin/logs/analytics${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to get analytics: ${response.statusText}`);
        }
        return response.json();
    }

    // Embedding Providers
    async getEmbeddingProviders(): Promise<ProvidersResponse> {
        const response = await fetch(`${this.baseUrl}/admin/providers/embedding`);
        if (!response.ok) {
            throw new Error(`Failed to fetch embedding providers: ${response.statusText}`);
        }
        return response.json();
    }

    // Embedding Logs
    async listEmbeddingLogs(query?: Partial<EmbeddingLogsQuery>): Promise<EmbeddingLogListResponse> {
        const params = new URLSearchParams();
        if (query?.page) params.set('page', query.page.toString());
        if (query?.limit) params.set('limit', query.limit.toString());
        if (query?.provider) params.set('provider', query.provider);
        if (query?.model) params.set('model', query.model);
        if (query?.startDate) params.set('startDate', query.startDate);
        if (query?.endDate) params.set('endDate', query.endDate);
        if (query?.apiKeyId) params.set('apiKeyId', query.apiKeyId);

        const url = `${this.baseUrl}/admin/logs/embeddings${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to list embedding logs: ${response.statusText}`);
        }
        return response.json();
    }

    async getEmbeddingLog(id: string): Promise<EmbeddingLogItem & {
        apiKey: { id: string; name: string };
    }> {
        const response = await fetch(`${this.baseUrl}/admin/logs/embeddings/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to get embedding log: ${response.statusText}`);
        }
        return response.json();
    }

    async getEmbeddingAnalytics(query?: Partial<AnalyticsQuery>): Promise<EmbeddingAnalyticsResponse> {
        const params = new URLSearchParams();
        if (query?.range) params.set('range', query.range);

        const url = `${this.baseUrl}/admin/logs/embeddings/analytics${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to get embedding analytics: ${response.statusText}`);
        }
        return response.json();
    }
}

export const gateway = new GatewayClient();
