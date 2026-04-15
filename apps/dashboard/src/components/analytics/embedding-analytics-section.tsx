'use client';

import { Activity, CheckCircle2, Cpu, Database, Hash } from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { AnalyticsRange, EmbeddingAnalyticsResponse } from '@synapse/shared';
import { ProviderChart } from '@/components/analytics/provider-chart';
import { StatCard } from '@/components/analytics/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EmbeddingAnalyticsSectionProps {
    analytics: EmbeddingAnalyticsResponse | null;
    loading: boolean;
    error: string | null;
    range: AnalyticsRange;
    onRetry?: () => void;
}

export function EmbeddingAnalyticsSection({
    analytics,
    loading,
    error,
    range,
    onRetry,
}: EmbeddingAnalyticsSectionProps) {
    if (error) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-destructive">{error}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Make sure the gateway is running.
                    </p>
                    {onRetry ? (
                        <Button className="mt-4" onClick={onRetry}>
                            Retry
                        </Button>
                    ) : null}
                </CardContent>
            </Card>
        );
    }

    if (loading && !analytics) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading embedding analytics...</p>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Failed to load embedding analytics</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard
                    title="Total Requests"
                    value={formatNumber(analytics.totalRequests)}
                    icon={Activity}
                    description={getRangeDescription(range)}
                />
                <StatCard
                    title="Success Rate"
                    value={`${analytics.successRate.toFixed(1)}%`}
                    icon={CheckCircle2}
                    description={`${formatNumber(analytics.totalRequests)} / ${formatNumber(analytics.totalResponses)} successful`}
                />
                <StatCard
                    title="Total Tokens"
                    value={formatNumber(analytics.totalTokens)}
                    icon={Database}
                    description="Token consumption"
                />
                <StatCard
                    title="Avg Latency"
                    value={analytics.avgLatency ? `${Math.round(analytics.avgLatency)}ms` : 'N/A'}
                    icon={Cpu}
                    description="Response time"
                />
                <StatCard
                    title="Unique Models"
                    value={analytics.uniqueModels.toString()}
                    icon={Hash}
                    description={`${analytics.uniqueProviders} provider${analytics.uniqueProviders !== 1 ? 's' : ''}`}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Token Usage Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analytics.tokenUsageOverTime.length === 0 ? (
                            <div className="flex h-[300px] items-center justify-center">
                                <p className="text-muted-foreground">No data available</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={analytics.tokenUsageOverTime.map(d => ({
                                    ...d,
                                    date: formatDate(d.date),
                                }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="tokens"
                                        name="Tokens"
                                        stroke="#8884d8"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        name="Requests"
                                        stroke="#82ca9d"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Latency Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analytics.latencyOverTime.length === 0 ? (
                            <div className="flex h-[300px] items-center justify-center">
                                <p className="text-muted-foreground">No data available</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={analytics.latencyOverTime.map(d => ({
                                    ...d,
                                    date: formatDate(d.date),
                                    p50: d.p50 !== null ? Math.round(d.p50) : null,
                                    p90: d.p90 !== null ? Math.round(d.p90) : null,
                                    p99: d.p99 !== null ? Math.round(d.p99) : null,
                                }))}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} unit="ms" />
                                    <Tooltip formatter={value => [typeof value === 'number' ? `${value}ms` : '-']} />
                                    <Legend />
                                    <Line type="monotone" dataKey="p50" name="P50" stroke="#82ca9d" strokeWidth={2} dot={false} connectNulls />
                                    <Line type="monotone" dataKey="p90" name="P90" stroke="#8884d8" strokeWidth={2} dot={false} connectNulls />
                                    <Line type="monotone" dataKey="p99" name="P99" stroke="#ff7300" strokeWidth={2} dot={false} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <ProviderChart data={analytics.providerStats} />

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Model Usage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {analytics.modelStats.length === 0 ? (
                            <div className="flex h-[300px] items-center justify-center">
                                <p className="text-muted-foreground">No data available</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(200, analytics.modelStats.length * 50)}>
                                <BarChart data={analytics.modelStats} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tick={{ fontSize: 12 }} />
                                    <YAxis dataKey="model" type="category" width={180} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Requests" fill="#8884d8" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function getRangeDescription(range: AnalyticsRange): string {
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
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (dateStr.length === 20 && dateStr.includes(':00Z')) {
        return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    if (dateStr.includes('T')) {
        return date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}
