'use client';

import { User, Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Message } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';

interface MessageListProps {
    messages: Message[];
    isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                    <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-lg font-medium text-muted-foreground">
                        Start a conversation
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Enter your API key and send a message to begin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
                <div
                    key={message.id}
                    className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                >
                    {message.role === 'assistant' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Bot className="h-4 w-4" />
                        </div>
                    )}
                    <div
                        className={cn(
                            'max-w-[70%] rounded-lg px-4 py-2',
                            message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted',
                        )}
                    >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        {message.role === 'assistant' && message.content === '' && isLoading && (
                            <span className="inline-block animate-pulse">▊</span>
                        )}
                    </div>
                    {message.role === 'user' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            <User className="h-4 w-4" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
