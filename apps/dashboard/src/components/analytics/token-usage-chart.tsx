'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TokenUsagePoint } from '@synapse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenUsageChartProps {
    data: TokenUsagePoint[];
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
    if (data.length === 0) {
        return (
            <Card className="col-span-2">
                <CardHeader>
                    <CardTitle className="text-base">Token Usage Over Time</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[300px] items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map(d => ({
        date: formatDate(d.date),
        input: d.inputTokens,
        output: d.outputTokens,
        total: d.totalTokens,
    }));

    return (
        <Card className="col-span-2">
            <CardHeader>
                <CardTitle className="text-base">Token Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="input"
                            name="Input Tokens"
                            stroke="#8884d8"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="output"
                            name="Output Tokens"
                            stroke="#82ca9d"
                            strokeWidth={2}
                            dot={false}
                        />
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
