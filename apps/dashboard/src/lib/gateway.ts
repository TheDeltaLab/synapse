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

    // Chat completions (for playground)
    async* streamChatCompletion(
        apiKey: string,
        messages: Array<{ role: string; content: string }>,
        options: {
            model: string;
            provider?: string;
            temperature?: number;
            maxTokens?: number;
            cacheEnabled?: boolean;
        },
    ): AsyncGenerator<string, void, unknown> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };

        // Add provider header if specified
        if (options.provider) {
            headers['x-synapse-provider'] = options.provider;
        }

        if (options.cacheEnabled === false) {
            headers['x-synapse-cache'] = 'false';
        }

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: options.model,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 1024,
                stream: true,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to get chat completion');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) yield content;
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    // Embeddings (for playground)
    async createEmbedding(
        apiKey: string,
        body: Record<string, unknown>,
        provider?: string,
        options?: { cacheEnabled?: boolean },
    ): Promise<unknown> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };

        if (provider) {
            headers['x-synapse-provider'] = provider;
        }

        if (options?.cacheEnabled === false) {
            headers['x-synapse-cache'] = 'false';
        }

        const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || error.message || 'Failed to generate embedding');
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
