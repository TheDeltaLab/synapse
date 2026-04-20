'use client';

import { Activity, CheckCircle2, Cpu, Database, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
    AnalyticsResponse,
    AnalyticsRange,
    ApiKeyResponse,
    EmbeddingAnalyticsResponse,
} from '@synapse/shared';
import { EmbeddingAnalyticsSection } from '@/components/analytics/embedding-analytics-section';
import { LatencyChart } from '@/components/analytics/latency-chart';
import { ModelTable } from '@/components/analytics/model-table';
import { ProviderChart } from '@/components/analytics/provider-chart';
import { RequestsChart } from '@/components/analytics/requests-chart';
import { StatCard } from '@/components/analytics/stat-card';
import { TokenUsageChart } from '@/components/analytics/token-usage-chart';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { gateway } from '@/lib/gateway';

const ranges: { value: AnalyticsRange; label: string }[] = [
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
];

const getRangeDescription = (range: AnalyticsRange): string => {
    switch (range) {
        case '15m':
            return 'Last 15 minutes';
        case '1h':
            return 'Last hour';
        case '24h':
            return 'Last 24 hours';
        case '7d':
            return 'Last 7 days';
        case '30d':
            return 'Last 30 days';
    }
};

export default function AnalyticsPage() {
    const [chatAnalytics, setChatAnalytics] = useState<AnalyticsResponse | null>(null);
    const [embeddingAnalytics, setEmbeddingAnalytics] = useState<EmbeddingAnalyticsResponse | null>(null);
    const [chatLoading, setChatLoading] = useState(true);
    const [embeddingLoading, setEmbeddingLoading] = useState(true);
    const [chatError, setChatError] = useState<string | null>(null);
    const [embeddingError, setEmbeddingError] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKeyResponse[]>([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(true);
    const [range, setRange] = useState<AnalyticsRange>('24h');
    const [selectedApiKeyId, setSelectedApiKeyId] = useState('all');
    const [activeTab, setActiveTab] = useState<'chat' | 'embedding'>('chat');
    const [chatCacheMissOnly, setChatCacheMissOnly] = useState(false);
    const [embeddingCacheMissOnly, setEmbeddingCacheMissOnly] = useState(false);

    const loadApiKeys = useCallback(async () => {
        setApiKeysLoading(true);
        try {
            const response = await gateway.listApiKeys();
            setApiKeys(response.data);
        } catch (err) {
            console.error('Failed to load API keys:', err);
        } finally {
            setApiKeysLoading(false);
        }
    }, []);

    const loadChatAnalytics = useCallback(async () => {
        const apiKeyId = selectedApiKeyId !== 'all' ? selectedApiKeyId : undefined;

        setChatLoading(true);
        setChatError(null);

        try {
            const data = await gateway.getAnalytics({ range, apiKeyId, cacheMissOnly: chatCacheMissOnly });
            setChatAnalytics(data);
        } catch (err) {
            console.error('Failed to load chat analytics:', err);
            setChatAnalytics(null);
            setChatError(err instanceof Error ? err.message : 'Failed to load chat analytics');
        } finally {
            setChatLoading(false);
        }
    }, [chatCacheMissOnly, range, selectedApiKeyId]);

    const loadEmbeddingAnalytics = useCallback(async () => {
        const apiKeyId = selectedApiKeyId !== 'all' ? selectedApiKeyId : undefined;

        setEmbeddingLoading(true);
        setEmbeddingError(null);

        try {
            const data = await gateway.getEmbeddingAnalytics({ range, apiKeyId, cacheMissOnly: embeddingCacheMissOnly });
            setEmbeddingAnalytics(data);
        } catch (err) {
            console.error('Failed to load embedding analytics:', err);
            setEmbeddingAnalytics(null);
            setEmbeddingError(err instanceof Error ? err.message : 'Failed to load embedding analytics');
        } finally {
            setEmbeddingLoading(false);
        }
    }, [embeddingCacheMissOnly, range, selectedApiKeyId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([loadChatAnalytics(), loadEmbeddingAnalytics()]);
    }, [loadChatAnalytics, loadEmbeddingAnalytics]);

    useEffect(() => {
        void loadApiKeys();
    }, [loadApiKeys]);

    useEffect(() => {
        void loadChatAnalytics();
    }, [loadChatAnalytics]);

    useEffect(() => {
        void loadEmbeddingAnalytics();
    }, [loadEmbeddingAnalytics]);

    return (
        <div className="flex h-full flex-col">
            <Header
                title="Analytics"
                description="Monitor your API usage and performance"
            >
                <div className="flex gap-1">
                    {ranges.map(r => (
                        <Button
                            key={r.value}
                            variant={range === r.value ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setRange(r.value)}
                        >
                            {r.label}
                        </Button>
                    ))}
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => void refreshAll()}
                    disabled={chatLoading || embeddingLoading}
                >
                    <RefreshCw className={`h-4 w-4 ${chatLoading || embeddingLoading ? 'animate-spin' : ''}`} />
                </Button>
            </Header>

            <div className="flex-1 p-6">
                <div className="space-y-8">
                    <Card>
                        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">API Key</p>
                                <Select value={selectedApiKeyId} onValueChange={setSelectedApiKeyId}>
                                    <SelectTrigger className="w-full min-w-[240px] lg:w-[280px]" disabled={apiKeysLoading}>
                                        <SelectValue placeholder="All API Keys" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All API Keys</SelectItem>
                                        {apiKeys.map(apiKey => (
                                            <SelectItem key={apiKey.id} value={apiKey.id}>
                                                {apiKey.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="inline-flex rounded-lg border bg-muted/50 p-1 self-start lg:self-auto">
                                <Button
                                    variant={activeTab === 'chat' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setActiveTab('chat')}
                                >
                                    Chat Analytics
                                </Button>
                                <Button
                                    variant={activeTab === 'embedding' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setActiveTab('embedding')}
                                >
                                    Embedding Analytics
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        {activeTab === 'chat' ? (
                            <section className="space-y-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold">Chat Analytics</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Analyze successful chat requests, latency, cache usage, and token consumption.
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-start gap-1 rounded-lg border px-3 py-2 lg:items-end">
                                        <label htmlFor="chat-cache-miss-only" className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                id="chat-cache-miss-only"
                                                type="checkbox"
                                                checked={chatCacheMissOnly}
                                                onChange={event => setChatCacheMissOnly(event.target.checked)}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            />
                                            <span>Only cache misses</span>
                                        </label>
                                        <p className="text-xs text-muted-foreground">Applies to Chat Analytics only.</p>
                                    </div>
                                </div>

                                {chatError ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <p className="text-destructive">{chatError}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Make sure the gateway is running.
                                            </p>
                                            <Button className="mt-4" onClick={() => void loadChatAnalytics()}>
                                                Retry
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : chatLoading && !chatAnalytics ? (
                                    <div className="flex items-center justify-center py-12">
                                        <p className="text-muted-foreground">Loading chat analytics...</p>
                                    </div>
                                ) : chatAnalytics ? (
                                    <div className="space-y-6">
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                                            <StatCard
                                                title="Total Requests"
                                                value={formatNumber(chatAnalytics.totalRequests)}
                                                icon={Activity}
                                                description={getRangeDescription(range)}
                                            />
                                            <StatCard
                                                title="Success Rate"
                                                value={`${chatAnalytics.successRate.toFixed(1)}%`}
                                                icon={CheckCircle2}
                                                description={`${formatNumber(chatAnalytics.totalRequests)} / ${formatNumber(chatAnalytics.totalResponses)} successful`}
                                            />
                                            {chatCacheMissOnly ? (
                                                <StatCard
                                                    title="Cache Scope"
                                                    value="Misses only"
                                                    icon={Zap}
                                                    description="Cached responses excluded"
                                                />
                                            ) : (
                                                <StatCard
                                                    title="Cache Hit Rate"
                                                    value={`${chatAnalytics.cacheHitRate.toFixed(1)}%`}
                                                    icon={Zap}
                                                    description="Cached responses"
                                                />
                                            )}
                                            <StatCard
                                                title="Avg Latency"
                                                value={chatAnalytics.avgLatency ? `${Math.round(chatAnalytics.avgLatency)}ms` : 'N/A'}
                                                icon={Cpu}
                                                description="Response time"
                                            />
                                            <StatCard
                                                title="Total Tokens"
                                                value={formatNumber(chatAnalytics.totalTokens)}
                                                icon={Database}
                                                description={`${formatNumber(chatAnalytics.totalInputTokens)} in / ${formatNumber(chatAnalytics.totalOutputTokens)} out`}
                                            />
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <RequestsChart data={chatAnalytics.requestsOverTime} />
                                            <LatencyChart data={chatAnalytics.latencyOverTime} modelStats={chatAnalytics.modelLatencyStats} />
                                            <ProviderChart data={chatAnalytics.providerStats} />
                                            <ModelTable data={chatAnalytics.modelStats} />
                                            <TokenUsageChart data={chatAnalytics.tokenUsageOverTime} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-12">
                                        <p className="text-muted-foreground">Failed to load chat analytics</p>
                                    </div>
                                )}
                            </section>
                        ) : (
                            <section className="space-y-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold">Embedding Analytics</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Analyze successful embedding requests, cache usage, provider mix, model usage, and latency trends.
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-start gap-1 rounded-lg border px-3 py-2 lg:items-end">
                                        <label htmlFor="embedding-cache-miss-only" className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                id="embedding-cache-miss-only"
                                                type="checkbox"
                                                checked={embeddingCacheMissOnly}
                                                onChange={event => setEmbeddingCacheMissOnly(event.target.checked)}
                                                className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            />
                                            <span>Only cache misses</span>
                                        </label>
                                        <p className="text-xs text-muted-foreground">Applies to Embedding Analytics only.</p>
                                    </div>
                                </div>
                                <EmbeddingAnalyticsSection
                                    analytics={embeddingAnalytics}
                                    loading={embeddingLoading}
                                    error={embeddingError}
                                    range={range}
                                    cacheMissOnly={embeddingCacheMissOnly}
                                    onRetry={() => void loadEmbeddingAnalytics()}
                                />
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
