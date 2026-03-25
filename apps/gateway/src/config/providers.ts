export type ModelTask = 'chat' | 'embedding';
export type ModelIOType = 'text' | 'image' | 'audio' | 'video' | 'embedding';
export type ModelCapability = 'streaming' | 'tool-calling' | 'json-mode' | 'vision' | 'embedding-dimensions';
export type ProtocolFamily = 'openai' | 'anthropic' | 'google';
export type SdkAdapter = 'openai' | 'anthropic' | 'google' | 'openrouter-sdk';

export abstract class Provider<Id extends string = string> {
    readonly id: Id;
    readonly name: string;
    readonly baseUrl?: string;
    readonly enabled: boolean;

    constructor(p: { id: Id; name: string; baseUrl?: string; enabled?: boolean }) {
        this.id = p.id;
        this.name = p.name;
        this.baseUrl = p.baseUrl;
        this.enabled = p.enabled ?? true;
    }

    abstract getApiKey(): string;

    isAvailable(): boolean {
        return this.enabled && Boolean(this.getApiKey());
    }
}

export interface Model {
    readonly id: string;
    readonly name: string;
    readonly task: ModelTask;
    readonly inputTypes: readonly ModelIOType[];
    readonly outputTypes: readonly ModelIOType[];
    readonly capabilities: readonly ModelCapability[];
}

export interface Deployment {
    readonly id: string;
    readonly providerId: string;
    readonly modelId: string;
    readonly task: ModelTask;
    readonly protocolFamily: ProtocolFamily;
    readonly sdkAdapter: SdkAdapter;
    readonly upstreamModel: string;
    readonly isDefault?: boolean;
    readonly enabled?: boolean;
    readonly capabilityOverrides?: Partial<Record<ModelCapability, boolean>>;
}

function envOrUndefined(key: string): string | undefined {
    const value = process.env[key]?.trim();
    return value || undefined;
}

class OpenAIProvider extends Provider<'openai'> {
    constructor() {
        super({
            id: 'openai',
            name: 'OpenAI',
            baseUrl: envOrUndefined('OPENAI_BASE_URL'),
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
            baseUrl: envOrUndefined('ANTHROPIC_BASE_URL'),
        });
    }

    getApiKey(): string {
        return process.env.ANTHROPIC_API_KEY?.trim() ?? '';
    }
}

class GoogleProvider extends Provider<'google'> {
    constructor() {
        super({
            id: 'google',
            name: 'Google',
            baseUrl: envOrUndefined('GOOGLE_BASE_URL'),
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
            baseUrl: envOrUndefined('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
        });
    }

    getApiKey(): string {
        return process.env.OPENROUTER_API_KEY?.trim() ?? '';
    }
}

export const providers = [
    new OpenAIProvider(),
    new AnthropicProvider(),
    new GoogleProvider(),
    new OpenRouterProvider(),
] as const satisfies readonly Provider[];

export type ProviderName = (typeof providers)[number]['id'];

export const models = [
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Exp',
        task: 'chat',
        inputTypes: ['text', 'image', 'audio', 'video'],
        outputTypes: ['text'],
        capabilities: ['streaming', 'tool-calling', 'json-mode', 'vision'],
    },
    {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        task: 'chat',
        inputTypes: ['text', 'image'],
        outputTypes: ['text'],
        capabilities: ['streaming', 'tool-calling', 'json-mode', 'vision'],
    },
    {
        id: 'qwen/qwen3-embedding-8b',
        name: 'Qwen3 Embedding 8B',
        task: 'embedding',
        inputTypes: ['text'],
        outputTypes: ['embedding'],
        capabilities: ['embedding-dimensions'],
    },
] as const satisfies readonly Model[];

export const deployments = [
    {
        id: 'google:gemini-2.0-flash-exp:chat',
        providerId: 'google',
        modelId: 'gemini-2.0-flash-exp',
        task: 'chat',
        protocolFamily: 'google',
        sdkAdapter: 'google',
        upstreamModel: 'gemini-2.0-flash-exp',
        isDefault: true,
    },
    {
        id: 'openrouter:gpt-5-mini:chat',
        providerId: 'openrouter',
        modelId: 'gpt-5-mini',
        task: 'chat',
        protocolFamily: 'openai',
        sdkAdapter: 'openrouter-sdk',
        upstreamModel: 'gpt-5-mini',
        isDefault: true,
    },
    {
        id: 'openrouter:qwen/qwen3-embedding-8b:embedding',
        providerId: 'openrouter',
        modelId: 'qwen/qwen3-embedding-8b',
        task: 'embedding',
        protocolFamily: 'openai',
        sdkAdapter: 'openai',
        upstreamModel: 'qwen/qwen3-embedding-8b',
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
