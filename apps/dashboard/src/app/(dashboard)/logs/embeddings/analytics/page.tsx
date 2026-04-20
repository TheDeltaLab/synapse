'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AnalyticsRange, EmbeddingAnalyticsResponse } from '@synapse/shared';
import { EmbeddingAnalyticsSection } from '@/components/analytics/embedding-analytics-section';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { gateway } from '@/lib/gateway';

const ranges: { value: AnalyticsRange; label: string }[] = [
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
];

export default function EmbeddingAnalyticsPage() {
    const [analytics, setAnalytics] = useState<EmbeddingAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<AnalyticsRange>('24h');
    const [cacheMissOnly, setCacheMissOnly] = useState(false);

    const loadAnalytics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await gateway.getEmbeddingAnalytics({ range, cacheMissOnly });
            setAnalytics(data);
        } catch (err) {
            console.error('Failed to load embedding analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [cacheMissOnly, range]);

    useEffect(() => {
        void loadAnalytics();
    }, [loadAnalytics]);

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
                    onClick={() => void loadAnalytics()}
                    disabled={loading}
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </Header>

            <div className="flex-1 p-6">
                <div className="mb-4 flex flex-col items-start gap-1 rounded-lg border px-3 py-2 lg:w-fit">
                    <label htmlFor="embedding-cache-miss-only" className="flex items-center gap-2 text-sm font-medium">
                        <input
                            id="embedding-cache-miss-only"
                            type="checkbox"
                            checked={cacheMissOnly}
                            onChange={event => setCacheMissOnly(event.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                        <span>Only cache misses</span>
                    </label>
                    <p className="text-xs text-muted-foreground">Applies to Embedding Analytics only.</p>
                </div>
                <EmbeddingAnalyticsSection
                    analytics={analytics}
                    loading={loading}
                    error={error}
                    range={range}
                    cacheMissOnly={cacheMissOnly}
                    onRetry={() => void loadAnalytics()}
                />
            </div>
        </div>
    );
}
