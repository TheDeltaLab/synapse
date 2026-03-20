'use client';

import { Bot, Clock, Cpu, Hash, Loader2, User, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RequestLogDetail } from '@synapse/shared';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { gateway } from '@/lib/gateway';

interface ChatDetailPanelProps {
    logId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChatDetailPanel({ logId, open, onOpenChange }: ChatDetailPanelProps) {
    const [detail, setDetail] = useState<RequestLogDetail | null>(null);
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
            const data = await gateway.getLog(id);
            setDetail(data);
        } catch (err) {
            console.error('Failed to load log detail:', err);
            setError(err instanceof Error ? err.message : 'Failed to load log detail');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto p-0"
            >
                <SheetHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
                    <SheetTitle>Chat Log Detail</SheetTitle>
                    <SheetDescription>
                        {detail
                            ? `${detail.provider} / ${detail.model}`
                            : 'Loading...'}
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
                            <p className="mt-1 text-xs text-muted-foreground">
                                Content may not be available if encryption is disabled.
                            </p>
                        </div>
                    ) : detail ? (
                        <div className="space-y-6">
                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-3">
                                <MetaItem
                                    icon={<Cpu className="h-3.5 w-3.5" />}
                                    label="Provider"
                                    value={detail.provider}
                                />
                                <MetaItem
                                    icon={<Bot className="h-3.5 w-3.5" />}
                                    label="Model"
                                    value={detail.model}
                                />
                                <MetaItem
                                    icon={<Hash className="h-3.5 w-3.5" />}
                                    label="Tokens"
                                    value={
                                        detail.totalTokens != null
                                            ? `${detail.inputTokens?.toLocaleString() ?? 0} in / ${detail.outputTokens?.toLocaleString() ?? 0} out`
                                            : '-'
                                    }
                                />
                                <MetaItem
                                    icon={<Clock className="h-3.5 w-3.5" />}
                                    label="Latency"
                                    value={detail.latency ? `${detail.latency}ms` : '-'}
                                />
                                <MetaItem
                                    icon={<Zap className="h-3.5 w-3.5" />}
                                    label="Status"
                                    value={(
                                        <Badge
                                            variant={detail.statusCode === 200 ? 'success' : 'destructive'}
                                            className="text-[11px]"
                                        >
                                            {detail.statusCode}
                                        </Badge>
                                    )}
                                />
                                <MetaItem
                                    icon={<Clock className="h-3.5 w-3.5" />}
                                    label="Time"
                                    value={new Date(detail.createdAt).toLocaleString()}
                                />
                            </div>

                            {/* Conversation */}
                            <div>
                                <h3 className="mb-3 text-sm font-medium text-foreground">
                                    Conversation
                                </h3>
                                <div className="space-y-3">
                                    {detail.promptMessages && detail.promptMessages.length > 0 ? (
                                        <>
                                            {detail.promptMessages.map((msg, i) => (
                                                <MessageBubble
                                                    key={`prompt-${i}`}
                                                    role={msg.role}
                                                    content={msg.content}
                                                />
                                            ))}
                                            {detail.responseContent && (
                                                <MessageBubble
                                                    role="assistant"
                                                    content={detail.responseContent}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <p className="py-4 text-center text-sm text-muted-foreground">
                                            No conversation content available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function MetaItem({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-2 rounded-md border p-2.5">
            <span className="mt-0.5 text-muted-foreground">{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="truncate text-sm font-medium">{value}</div>
            </div>
        </div>
    );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
    const isUser = role === 'user';
    const isSystem = role === 'system';

    return (
        <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
            {!isUser && (
                <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isSystem
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-primary/10 text-primary'
                    }`}
                >
                    {isSystem ? (
                        <Cpu className="h-3.5 w-3.5" />
                    ) : (
                        <Bot className="h-3.5 w-3.5" />
                    )}
                </div>
            )}
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : isSystem
                            ? 'border border-yellow-200 bg-yellow-50 text-yellow-900'
                            : 'bg-muted'
                }`}
            >
                <p className="mb-1 text-[10px] font-semibold uppercase opacity-70">
                    {role}
                </p>
                <div className="whitespace-pre-wrap break-words">{content}</div>
            </div>
            {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-3.5 w-3.5" />
                </div>
            )}
        </div>
    );
}
