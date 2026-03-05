'use client';

import { PieChart, Pie, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { ProviderStats } from '@synapse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProviderChartProps {
    data: ProviderStats[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

export function ProviderChart({ data }: ProviderChartProps) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Requests by Provider</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[300px] items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = data.map((d, index) => ({
        name: d.provider,
        value: d.count,
        fill: COLORS[index % COLORS.length],
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Requests by Provider</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
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
            </CardContent>
        </Card>
    );
}
