'use client';

import { Activity, Cpu, Database, Hash, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    BarChart,
    Bar,
} from 'recharts';
import type { EmbeddingAnalyticsResponse, AnalyticsRange } from '@synapse/shared';
import { StatCard } from '@/components/analytics/stat-card';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { gateway } from '@/lib/gateway';

const ranges: { value: AnalyticsRange; label: string }[] = [
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

const getRangeDescription = (range: AnalyticsRange): string => {
    switch (range) {
        case '15m': return 'Last 15 minutes';
        case '1h': return 'Last hour';
        case '24h': return 'Last 24 hours';
        case '7d': return 'Last 7 days';
        case '30d': return 'Last 30 days';
    }
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (dateStr.length === 20 && dateStr.includes(':00Z')) {
        return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (dateStr.includes('T')) {
        return date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export default function EmbeddingAnalyticsPage() {
    const [analytics, setAnalytics] = useState<EmbeddingAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<AnalyticsRange>('24h');

    useEffect(() => {
        loadAnalytics();
    }, [range]);

    async function loadAnalytics() {
        setLoading(true);
        setError(null);
        try {
            const data = await gateway.getEmbeddingAnalytics({ range });
            setAnalytics(data);
        } catch (err) {
            console.error('Failed to load embedding analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-full flex-col">
            <Header
                title="Embedding Analytics"
                description="Analyze embedding API usage and performance"
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

                        {/* Charts */}
                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Token Usage Over Time */}
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

                            {/* Latency Distribution */}
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

                            {/* Provider Distribution */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Requests by Provider</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {analytics.providerStats.length === 0 ? (
                                        <div className="flex h-[300px] items-center justify-center">
                                            <p className="text-muted-foreground">No data available</p>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={analytics.providerStats.map((s, i) => ({
                                                        name: s.provider,
                                                        value: s.count,
                                                        fill: COLORS[i % COLORS.length],
                                                    }))}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    label={({ name, percent }: { name?: string; percent?: number }) =>
                                                        `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                                                    labelLine={false}
                                                />
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Model Usage */}
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
                ) : (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Failed to load analytics</p>
                    </div>
                )}
            </div>
        </div>
    );
}
