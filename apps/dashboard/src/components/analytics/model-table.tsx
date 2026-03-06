'use client';

import type { ModelStats } from '@synapse/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ModelTableProps {
    data: ModelStats[];
}

export function ModelTable({ data }: ModelTableProps) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Requests by Model</CardTitle>
                </CardHeader>
                <CardContent className="flex h-[300px] items-center justify-center">
                    <p className="text-muted-foreground">No data available</p>
                </CardContent>
            </Card>
        );
    }

    const sortedData = [...data].sort((a, b) => b.count - a.count);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Requests by Model</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-card">
                            <tr className="border-b bg-muted/50">
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Model</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Provider</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Requests</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Avg Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map(item => (
                                <tr key={`${item.provider}-${item.model}`} className="border-b last:border-0">
                                    <td className="px-4 py-2">
                                        <span className="text-sm font-mono">
                                            {item.model.length > 30 ? item.model.slice(0, 27) + '...' : item.model}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge variant="outline" className="text-xs">
                                            {item.provider}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <span className="text-sm text-muted-foreground">
                                            {item.avgLatency !== null ? `${Math.round(item.avgLatency)}ms` : '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
