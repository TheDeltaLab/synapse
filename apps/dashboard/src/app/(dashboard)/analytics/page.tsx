'use client';

import { Activity, Database, Zap, Cpu, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AnalyticsResponse, AnalyticsRange } from '@synapse/shared';
import { LatencyChart } from '@/components/analytics/latency-chart';
import { ModelTable } from '@/components/analytics/model-table';
import { ProviderChart } from '@/components/analytics/provider-chart';
import { RequestsChart } from '@/components/analytics/requests-chart';
import { StatCard } from '@/components/analytics/stat-card';
import { TokenUsageChart } from '@/components/analytics/token-usage-chart';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        case '15m': return 'Last 15 minutes';
        case '1h': return 'Last hour';
        case '24h': return 'Last 24 hours';
        case '7d': return 'Last 7 days';
        case '30d': return 'Last 30 days';
    }
};

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<AnalyticsRange>('24h');

    useEffect(() => {
        loadAnalytics();
    }, [range]);

    const loadAnalytics = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await gateway.getAnalytics({ range });
            setAnalytics(data);
        } catch (err) {
            console.error('Failed to load analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

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
                    onClick={loadAnalytics}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </Header>

            <div className="flex-1 p-6">
                {error ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <p className="text-destructive">{error}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Make sure the gateway is running.
                            </p>
                            <Button className="mt-4" onClick={loadAnalytics}>
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : loading && !analytics ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Loading analytics...</p>
                    </div>
                ) : analytics ? (
                    <div className="space-y-6">
                        {/* Stat Cards */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                title="Total Requests"
                                value={formatNumber(analytics.totalRequests)}
                                icon={Activity}
                                description={getRangeDescription(range)}
                            />
                            <StatCard
                                title="Cache Hit Rate"
                                value={`${analytics.cacheHitRate.toFixed(1)}%`}
                                icon={Zap}
                                description="Cached responses"
                            />
                            <StatCard
                                title="Avg Latency"
                                value={analytics.avgLatency ? `${Math.round(analytics.avgLatency)}ms` : 'N/A'}
                                icon={Cpu}
                                description="Response time"
                            />
                            <StatCard
                                title="Total Tokens"
                                value={formatNumber(analytics.totalTokens)}
                                icon={Database}
                                description={`${formatNumber(analytics.totalInputTokens)} in / ${formatNumber(analytics.totalOutputTokens)} out`}
                            />
                        </div>

                        {/* Charts */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <RequestsChart data={analytics.requestsOverTime} />
                            <LatencyChart data={analytics.latencyOverTime} modelStats={analytics.modelLatencyStats} />
                            <ProviderChart data={analytics.providerStats} />
                            <ModelTable data={analytics.modelStats} />
                            <TokenUsageChart data={analytics.tokenUsageOverTime} />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Failed to load analytics</p>
                    </div>
                )}
            </div>
        </div>
    );
}
