'use client';

import { Clock, Cpu, Hash, Loader2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EmbeddingLogItem } from '@synapse/shared';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { gateway } from '@/lib/gateway';

interface EmbeddingDetailPanelProps {
    logId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Detail = EmbeddingLogItem & { apiKey?: { id: string; name: string } };

export function EmbeddingDetailPanel({ logId, open, onOpenChange }: EmbeddingDetailPanelProps) {
    const [detail, setDetail] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (logId && open) {
            loadDetail(logId);
        }
        if (!open) {
            setDetail(null);
            setError(null);
        }
    }, [logId, open]);

    async function loadDetail(id: string) {
        setLoading(true);
        setError(null);
        try {
            const data = await gateway.getEmbeddingLog(id);
            setDetail(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load embedding log detail');
        } finally {
            setLoading(false);
        }
    }

    const inputs = parseInputs(detail?.requestContent ?? null);
    const avgTokens = detail?.tokens && detail.inputCount > 0
        ? Math.round(detail.tokens / detail.inputCount)
        : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto p-0"
            >
                <SheetHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
                    <SheetTitle>Embedding Log Detail</SheetTitle>
                    <SheetDescription>
                        {detail ? `${detail.provider} / ${detail.model}` : 'Loading...'}
                    </SheetDescription>
                </SheetHeader>

                <div className="px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    ) : detail ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <Stat icon={<Hash className="h-4 w-4" />} label="Inputs" value={detail.inputCount.toLocaleString()} />
                                <Stat icon={<Cpu className="h-4 w-4" />} label="Tokens" value={detail.tokens?.toLocaleString() ?? '-'} />
                                <Stat icon={<Zap className="h-4 w-4" />} label="Dimensions" value={detail.dimensions?.toLocaleString() ?? 'auto'} />
                                <Stat icon={<Clock className="h-4 w-4" />} label="Latency" value={detail.latency ? `${detail.latency}ms` : '-'} />
                                {avgTokens !== null && detail.inputCount > 1 && (
                                    <Stat icon={<Cpu className="h-4 w-4" />} label="Avg tokens / input" value={avgTokens.toLocaleString()} />
                                )}
                                <Stat
                                    icon={<Hash className="h-4 w-4" />}
                                    label="Status"
                                    value={(
                                        <Badge variant={detail.statusCode === 200 ? 'success' : 'destructive'}>
                                            {detail.statusCode}
                                        </Badge>
                                    )}
                                />
                            </div>

                            <div>
                                <h4 className="mb-2 text-sm font-medium">
                                    Inputs
                                    {inputs && inputs.length > 1 ? ` (${inputs.length})` : ''}
                                </h4>
                                {!inputs ? (
                                    <p className="text-sm text-muted-foreground">No content available.</p>
                                ) : (
                                    <ol className="space-y-2">
                                        {inputs.map((text, i) => (
                                            <li key={i} className="rounded-md border bg-muted/40 p-3 text-sm">
                                                {inputs.length > 1 && (
                                                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                                                        #
                                                        {i + 1}
                                                    </span>
                                                )}
                                                <span className="break-words whitespace-pre-wrap">{text}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="ml-auto font-medium">{value}</span>
        </div>
    );
}

function parseInputs(content: string | null): string[] | null {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            const texts = parsed.filter((item): item is string => typeof item === 'string');
            return texts.length > 0 ? texts : null;
        }
    } catch {
        // fall through
    }
    return [content];
}
