'use client';

import { Send } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
    onSend: (content: string) => void;
    disabled: boolean;
    placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input);
            setInput('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t bg-card p-4">
            <div className="flex gap-2">
                <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="min-h-[60px] resize-none"
                    rows={2}
                />
                <Button
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                    size="icon"
                    className="h-[60px] w-[60px]"
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
            </p>
        </div>
    );
}
