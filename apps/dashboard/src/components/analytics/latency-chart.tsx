'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { LatencyOverTimePoint, ModelLatencyStats } from '@synapse/shared';

type PercentileType = 'p50' | 'p90' | 'p99' | 'avg';

interface LatencyChartProps {
    data: LatencyOverTimePoint[];
    modelStats: ModelLatencyStats[];
}

const PERCENTILE_OPTIONS: { value: PercentileType; label: string }[] = [
    { value: 'p50', label: 'P50' },
    { value: 'p90', label: 'P90' },
    { value: 'p99', label: 'P99' },
    { value: 'avg', label: 'Average' },
];

const COLORS: Record<PercentileType, string> = {
    p50: '#82ca9d',
    p90: '#8884d8',
    p99: '#ff7300',
    avg: '#ffc658',
};

export function LatencyChart({ data, modelStats }: LatencyChartProps) {
    const [selectedModel, setSelectedModel] = useState<string>('all');
    const [selectedPercentiles, setSelectedPercentiles] = useState<PercentileType[]>(['p50', 'p90', 'p99']);

    const models = modelStats.map(m => m.model);

    // For now, we show the overall latency time series
    // When a specific model is selected, we show a summary card
    const chartData = data.map(d => ({
        date: formatDate(d.date),
        p50: d.p50 !== null ? Math.round(d.p50) : null,
        p90: d.p90 !== null ? Math.round(d.p90) : null,
        p99: d.p99 !== null ? Math.round(d.p99) : null,
        avg: d.avg !== null ? Math.round(d.avg) : null,
    }));

    const selectedModelStats = selectedModel !== 'all'
        ? modelStats.find(m => m.model === selectedModel)
        : null;

    const togglePercentile = (percentile: PercentileType) => {
        if (selectedPercentiles.includes(percentile)) {
            if (selectedPercentiles.length > 1) {
                setSelectedPercentiles(selectedPercentiles.filter(p => p !== percentile));
            }
        } else {
            setSelectedPercentiles([...selectedPercentiles, percentile]);
        }
    };

    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Latency Over Time</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[300px] items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Latency Over Time</CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="All Models" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Models</SelectItem>
                                {models.map((model) => (
                                    <SelectItem key={model} value={model}>
                                        {model.length > 20 ? model.slice(0, 17) + '...' : model}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-1 mt-2">
                    {PERCENTILE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => togglePercentile(option.value)}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                selectedPercentiles.includes(option.value)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                {selectedModel !== 'all' && selectedModelStats ? (
                    <div className="mb-4 p-3 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium mb-2">{selectedModelStats.model}</p>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">P50</p>
                                <p className="font-medium">{selectedModelStats.p50 ? `${Math.round(selectedModelStats.p50)}ms` : '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">P90</p>
                                <p className="font-medium">{selectedModelStats.p90 ? `${Math.round(selectedModelStats.p90)}ms` : '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">P99</p>
                                <p className="font-medium">{selectedModelStats.p99 ? `${Math.round(selectedModelStats.p99)}ms` : '-'}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Avg</p>
                                <p className="font-medium">{selectedModelStats.avg ? `${Math.round(selectedModelStats.avg)}ms` : '-'}</p>
                            </div>
                        </div>
                    </div>
                ) : null}
                <ResponsiveContainer width="100%" height={selectedModel !== 'all' ? 220 : 300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} unit="ms" />
                        <Tooltip
                            formatter={(value: number | null | undefined) => [
                                value != null ? `${value}ms` : '-',
                            ]}
                        />
                        <Legend />
                        {selectedPercentiles.includes('p50') && (
                            <Line
                                type="monotone"
                                dataKey="p50"
                                name="P50"
                                stroke={COLORS.p50}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        )}
                        {selectedPercentiles.includes('p90') && (
                            <Line
                                type="monotone"
                                dataKey="p90"
                                name="P90"
                                stroke={COLORS.p90}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        )}
                        {selectedPercentiles.includes('p99') && (
                            <Line
                                type="monotone"
                                dataKey="p99"
                                name="P99"
                                stroke={COLORS.p99}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        )}
                        {selectedPercentiles.includes('avg') && (
                            <Line
                                type="monotone"
                                dataKey="avg"
                                name="Average"
                                stroke={COLORS.avg}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (dateStr.length === 20 && dateStr.includes(':00Z')) {
        // Minute format (2024-01-01T12:30:00Z)
        return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (dateStr.includes('T')) {
        // Hourly format
        return date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
    }
    // Daily format
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
