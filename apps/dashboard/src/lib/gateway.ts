import type {
    ApiKeyResponse,
    ApiKeyCreatedResponse,
    ApiKeyListResponse,
    CreateApiKeyInput,
    UpdateApiKeyInput,
} from '@synapse/shared';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';

class GatewayClient {
    private baseUrl: string;

    constructor(baseUrl: string = GATEWAY_URL) {
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

    // Chat completions (for playground)
    async* streamChatCompletion(
        apiKey: string,
        messages: Array<{ role: string; content: string }>,
        options: {
            model: string;
            temperature?: number;
            maxTokens?: number;
        },
    ): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
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
}

export const gateway = new GatewayClient();
