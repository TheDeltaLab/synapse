'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { ApiKeyCreatedResponse } from '@synapse/shared';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface KeyCreatedDialogProps {
    apiKey: ApiKeyCreatedResponse | null;
    open: boolean;
    onClose: () => void;
}

export function KeyCreatedDialog({ apiKey, open, onClose }: KeyCreatedDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (apiKey?.key) {
            await navigator.clipboard.writeText(apiKey.key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>API Key Created</DialogTitle>
                    <DialogDescription>
                        Your new API key has been created. Make sure to copy it now — you won&apos;t be able to see it again!
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border bg-muted p-4">
                        <p className="mb-2 text-sm font-medium">{apiKey?.name}</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 break-all rounded bg-background px-2 py-1 text-sm font-mono">
                                {apiKey?.key}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                            >
                                {copied
                                    ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        )
                                    : (
                                            <Copy className="h-4 w-4" />
                                        )}
                            </Button>
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        This key will be hidden after you close this dialog. Store it securely.
                    </p>
                </div>

                <DialogFooter>
                    <Button onClick={onClose}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
