export type ModelTask = 'chat' | 'embedding';

export abstract class Provider<Id extends string = string> {
    readonly id: Id;
    readonly name: string;
    readonly baseUrl: string;
    readonly enabled: boolean;

    constructor(p: { id: Id; name: string; baseUrl: string; enabled?: boolean }) {
        this.id = p.id;
        this.name = p.name;
        this.baseUrl = p.baseUrl;
        this.enabled = p.enabled ?? true;
    }

    abstract getApiKey(): string;

    isAvailable(): boolean {
        return this.enabled && Boolean(this.getApiKey());
    }

    getAuthHeaders(): Record<string, string> {
        return { Authorization: `Bearer ${this.getApiKey()}` };
    }
}

export interface Deployment {
    readonly id: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly task: ModelTask;
    readonly isDefault?: boolean;
    readonly enabled?: boolean;
    readonly deprecated?: boolean;
}

function envOrDefault(key: string, defaultValue: string): string {
    const value = process.env[key]?.trim();
    return value || defaultValue;
}

class OpenAIProvider extends Provider<'openai'> {
    constructor() {
        super({
            id: 'openai',
            name: 'OpenAI',
            baseUrl: envOrDefault('OPENAI_BASE_URL', 'https://api.openai.com'),
        });
    }

    getApiKey(): string {
        return process.env.OPENAI_API_KEY?.trim() ?? '';
    }
}

class AnthropicProvider extends Provider<'anthropic'> {
    constructor() {
        super({
            id: 'anthropic',
            name: 'Anthropic',
            baseUrl: envOrDefault('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
        });
    }

    getApiKey(): string {
        return process.env.ANTHROPIC_API_KEY?.trim() ?? '';
    }

    override getAuthHeaders(): Record<string, string> {
        return {
            'x-api-key': this.getApiKey(),
            'anthropic-version': '2023-06-01',
        };
    }
}

class GoogleProvider extends Provider<'google'> {
    constructor() {
        super({
            id: 'google',
            name: 'Google',
            baseUrl: envOrDefault('GOOGLE_BASE_URL', 'https://generativelanguage.googleapis.com'),
        });
    }

    getApiKey(): string {
        return process.env.GOOGLE_API_KEY?.trim() ?? '';
    }
}

class OpenRouterProvider extends Provider<'openrouter'> {
    constructor() {
        super({
            id: 'openrouter',
            name: 'OpenRouter',
            baseUrl: envOrDefault('OPENROUTER_BASE_URL', 'https://openrouter.ai/api'),
        });
    }

    getApiKey(): string {
        return process.env.OPENROUTER_API_KEY?.trim() ?? '';
    }
}

class DeepSeekProvider extends Provider<'deepseek'> {
    constructor() {
        super({
            id: 'deepseek',
            name: 'DeepSeek',
            baseUrl: envOrDefault('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        });
    }

    getApiKey(): string {
        return process.env.DEEPSEEK_API_KEY?.trim() ?? '';
    }
}

class AlibabaProvider extends Provider<'alibaba'> {
    constructor() {
        super({
            id: 'alibaba',
            name: 'Alibaba',
            baseUrl: envOrDefault('ALIBABA_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode'),
        });
    }

    getApiKey(): string {
        return process.env.ALIBABA_API_KEY?.trim() ?? '';
    }
}

export const providers = [
    new OpenAIProvider(),
    new AnthropicProvider(),
    new GoogleProvider(),
    new OpenRouterProvider(),
    new DeepSeekProvider(),
    new AlibabaProvider(),
] as const satisfies readonly Provider[];

export type ProviderName = (typeof providers)[number]['id'];

export const deployments = [
    {
        id: 'anthropic:claude-sonnet-4-6:chat',
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-6',
        task: 'chat',
        isDefault: true,
    },
    {
        id: 'anthropic:claude-opus-4-6:chat',
        providerId: 'anthropic',
        modelId: 'claude-opus-4-6',
        task: 'chat',
    },
    {
        id: 'anthropic:claude-haiku-4-5-20251001:chat',
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5-20251001',
        task: 'chat',
    },
    {
        id: 'google:gemini-2.0-flash-exp:chat',
        providerId: 'google',
        modelId: 'gemini-2.0-flash-exp',
        task: 'chat',
        isDefault: true,
    },
    {
        id: 'openrouter:gpt-5-mini:chat',
        providerId: 'openrouter',
        modelId: 'gpt-5-mini',
        task: 'chat',
        isDefault: true,
    },
    {
        id: 'openrouter:anthropic/claude-opus-4.7:chat',
        providerId: 'openrouter',
        modelId: 'anthropic/claude-opus-4.7',
        task: 'chat',
    },
    {
        id: 'openrouter:anthropic/claude-sonnet-4.6:chat',
        providerId: 'openrouter',
        modelId: 'anthropic/claude-sonnet-4.6',
        task: 'chat',
    },
    {
        id: 'openrouter:anthropic/claude-haiku-4.5:chat',
        providerId: 'openrouter',
        modelId: 'anthropic/claude-haiku-4.5',
        task: 'chat',
    },
    {
        id: 'openrouter:qwen/qwen3-embedding-8b:embedding',
        providerId: 'openrouter',
        modelId: 'qwen/qwen3-embedding-8b',
        task: 'embedding',
        isDefault: true,
    },
    {
        id: 'openrouter:qwen/qwen3-embedding-4b:embedding',
        providerId: 'openrouter',
        modelId: 'qwen/qwen3-embedding-4b',
        task: 'embedding',
    },
    {
        id: 'deepseek:deepseek-chat:chat',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        task: 'chat',
        deprecated: true,
    },
    {
        id: 'deepseek:deepseek-reasoner:chat',
        providerId: 'deepseek',
        modelId: 'deepseek-reasoner',
        task: 'chat',
        deprecated: true,
    },
    {
        id: 'deepseek:deepseek-v4-flash:chat',
        providerId: 'deepseek',
        modelId: 'deepseek-v4-flash',
        task: 'chat',
        isDefault: true,
    },
    {
        id: 'deepseek:deepseek-v4-pro:chat',
        providerId: 'deepseek',
        modelId: 'deepseek-v4-pro',
        task: 'chat',
    },
    {
        id: 'alibaba:qwen3.5-omni-plus:chat',
        providerId: 'alibaba',
        modelId: 'qwen3.5-omni-plus',
        task: 'chat',
        isDefault: true,
    },
    {
        id: 'alibaba:text-embedding-v4:embedding',
        providerId: 'alibaba',
        modelId: 'text-embedding-v4',
        task: 'embedding',
        isDefault: true,
    },
] as const satisfies readonly Deployment[];

const providerList: readonly Provider[] = providers;
const deploymentList: readonly Deployment[] = deployments;

const providerMap = new Map<string, Provider>(providerList.map(provider => [provider.id, provider]));
const deploymentMap = new Map<string, Deployment>(deploymentList.map(deployment => [
    `${deployment.providerId}:${deployment.modelId}:${deployment.task}`,
    deployment,
]));

function isProviderEnabled(providerId: string): boolean {
    return providerMap.get(providerId)?.enabled ?? false;
}

export function getProvider(id: string): Provider | undefined {
    return providerMap.get(id);
}

export function getDeployment(providerId: string, modelId: string, task: ModelTask): Deployment | undefined {
    if (!isProviderEnabled(providerId)) {
        return undefined;
    }

    const deployment = deploymentMap.get(`${providerId}:${modelId}:${task}`);
    if (!deployment || deployment.enabled === false) {
        return undefined;
    }

    return deployment;
}

export function findDeploymentByModel(modelId: string, task?: ModelTask): Deployment | undefined {
    return deploymentList.find(deployment => (
        deployment.modelId === modelId
        && (task === undefined || deployment.task === task)
        && deployment.enabled !== false
        && isProviderEnabled(deployment.providerId)
    ));
}

export function getChatDeployments(providerId: string): Deployment[] {
    if (!isProviderEnabled(providerId)) {
        return [];
    }

    return deploymentList.filter(deployment => (
        deployment.providerId === providerId
        && deployment.task === 'chat'
        && deployment.enabled !== false
    ));
}

export function getEmbeddingDeployments(providerId: string): Deployment[] {
    if (!isProviderEnabled(providerId)) {
        return [];
    }

    return deploymentList.filter(deployment => (
        deployment.providerId === providerId
        && deployment.task === 'embedding'
        && deployment.enabled !== false
    ));
}

export function getDefaultChatModel(providerId: string): string | undefined {
    return getChatDeployments(providerId).find(deployment => deployment.isDefault)?.modelId;
}

export function getDefaultEmbeddingModel(providerId: string): string | null {
    return getEmbeddingDeployments(providerId).find(deployment => deployment.isDefault)?.modelId ?? null;
}

export function getAvailableProviders(): ProviderName[] {
    return providers
        .filter(provider => provider.isAvailable())
        .map(provider => provider.id);
}

export function hasEmbeddingSupport(providerId: string): boolean {
    const provider = providerMap.get(providerId);
    if (!provider?.isAvailable()) return false;
    return getEmbeddingDeployments(providerId).length > 0;
}

export function getAvailableEmbeddingProviders(): ProviderName[] {
    return getAvailableProviders().filter(id => hasEmbeddingSupport(id));
}
