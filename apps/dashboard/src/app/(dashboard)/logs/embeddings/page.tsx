'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EmbeddingLogItem } from '@synapse/shared';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { gateway } from '@/lib/gateway';

export default function EmbeddingLogsPage() {
    const [logs, setLogs] = useState<EmbeddingLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [providerFilter, setProviderFilter] = useState<string>('all');
    const [providers, setProviders] = useState<string[]>([]);
    const limit = 20;

    useEffect(() => {
        loadProviders();
    }, []);

    useEffect(() => {
        loadLogs();
    }, [page, providerFilter]);

    async function loadProviders() {
        try {
            const data = await gateway.getEmbeddingProviders();
            setProviders(data.providers.filter(p => p.available).map(p => p.name));
        } catch (err) {
            console.error('Failed to load providers:', err);
        }
    }

    async function loadLogs() {
        setLoading(true);
        setError(null);
        try {
            const data = await gateway.listEmbeddingLogs({
                page,
                limit,
                provider: providerFilter !== 'all' ? providerFilter : undefined,
            });
            setLogs(data.logs);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (err) {
            console.error('Failed to load logs:', err);
            setError(err instanceof Error ? err.message : 'Failed to load logs');
        } finally {
            setLoading(false);
        }
    }

    function handleProviderChange(value: string) {
        setProviderFilter(value);
        setPage(1);
    }

    return (
        <div className="flex h-full flex-col">
            <Header
                title="Embedding Logs"
                description="View embedding API request logs"
            >
                <Select value={providerFilter} onValueChange={handleProviderChange}>
                    <SelectTrigger className="w-[160px] h-8">
                        <SelectValue placeholder="All Providers" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {providers.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={loadLogs}
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
                            <Button className="mt-4" onClick={loadLogs}>
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Content</TableHead>
                                        <TableHead className="text-right">Inputs</TableHead>
                                        <TableHead className="text-right">Tokens</TableHead>
                                        <TableHead className="text-right">Latency</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading && logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No embedding logs found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.map(log => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{log.provider}</Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {log.model}
                                                </TableCell>
                                                <TableCell className="max-w-xs text-sm">
                                                    <EmbeddingContentPreview content={log.requestContent} />
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {log.inputCount}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {log.tokens?.toLocaleString() ?? '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {log.latency ? `${log.latency}ms` : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={log.statusCode === 200 ? 'success' : 'destructive'}>
                                                        {log.statusCode}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>

                        {/* Pagination */}
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing
                                {' '}
                                {logs.length}
                                {' '}
                                of
                                {' '}
                                {total}
                                {' '}
                                logs
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p - 1)}
                                    disabled={page <= 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page
                                    {' '}
                                    {page}
                                    {' '}
                                    of
                                    {' '}
                                    {totalPages || 1}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const MAX_PREVIEW_LENGTH = 80;

function EmbeddingContentPreview({ content }: { content: string | null }) {
    if (!content) return <span className="text-muted-foreground">-</span>;

    // Try parsing as JSON array of input strings (new format)
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            const texts = parsed.filter((item): item is string => typeof item === 'string');
            if (texts.length > 0) {
                const preview = texts.length === 1
                    ? texts[0]!
                    : texts.map((t, i) => `${i + 1}. ${t}`).join(' ');
                const truncated = preview.length > MAX_PREVIEW_LENGTH
                    ? preview.slice(0, MAX_PREVIEW_LENGTH) + '...'
                    : preview;
                return (
                    // TODO: For large embedding inputs, texts.join('\n') in the title attribute
                    // can create very large DOM attributes and degrade rendering. Consider
                    // truncating the title or using a bounded tooltip.
                    <span className="break-all" title={texts.join('\n')}>
                        {truncated}
                    </span>
                );
            }
        }
    } catch {
        // Not valid JSON — fall through to raw display
    }

    // Fallback: display raw content truncated
    const truncated = content.length > MAX_PREVIEW_LENGTH
        ? content.slice(0, MAX_PREVIEW_LENGTH) + '...'
        : content;
    return <span className="break-all" title={content}>{truncated}</span>;
}
