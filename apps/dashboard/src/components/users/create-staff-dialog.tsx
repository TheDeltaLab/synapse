'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { CreateStaffForm } from '@/components/auth';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface CreateStaffDialogProps {
    onUserCreated?: () => void;
}

export function CreateStaffDialog({ onUserCreated }: CreateStaffDialogProps) {
    const [open, setOpen] = useState(false);

    function handleSuccess() {
        onUserCreated?.();
    }

    function handleOpenChange(newOpen: boolean) {
        setOpen(newOpen);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Staff
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Staff Account</DialogTitle>
                    <DialogDescription>
                        Create a new staff account. A temporary password will be generated.
                    </DialogDescription>
                </DialogHeader>
                <CreateStaffForm onSuccess={handleSuccess} />
            </DialogContent>
        </Dialog>
    );
}
