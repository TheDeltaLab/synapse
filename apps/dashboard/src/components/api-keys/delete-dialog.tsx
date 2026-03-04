'use client';

import type { ApiKeyResponse } from '@synapse/shared';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface DeleteDialogProps {
    apiKey: ApiKeyResponse | null;
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteDialog({ apiKey, open, onClose, onConfirm }: DeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete API Key</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the API key &quot;
                        {apiKey?.name}
                        &quot;? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
