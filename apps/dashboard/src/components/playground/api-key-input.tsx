'use client';

import { Eye, EyeOff, Key } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApiKeyInputProps {
    apiKey: string;
    onApiKeyChange: (key: string) => void;
}

export function ApiKeyInput({ apiKey, onApiKeyChange }: ApiKeyInputProps) {
    const [showKey, setShowKey] = useState(false);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <Label>API Key</Label>
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => onApiKeyChange(e.target.value)}
                        placeholder="sk-syn_..."
                        className="pr-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowKey(!showKey)}
                    >
                        {showKey
                            ? (
                                    <EyeOff className="h-4 w-4" />
                                )
                            : (
                                    <Eye className="h-4 w-4" />
                                )}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                Enter your Synapse API key to test the gateway
            </p>
        </div>
    );
}
