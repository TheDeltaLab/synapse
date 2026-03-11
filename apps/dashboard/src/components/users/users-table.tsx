'use client';

import type { UserResponse } from '@synapse/shared';

import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface UsersTableProps {
    users: UserResponse[];
}

function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' {
    return role === 'ADMIN' ? 'default' : 'secondary';
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'ACTIVE':
            return 'default';
        case 'INACTIVE':
            return 'destructive';
        case 'PENDING_PASSWORD_RESET':
            return 'outline';
        default:
            return 'secondary';
    }
}

function formatStatus(status: string): string {
    switch (status) {
        case 'PENDING_PASSWORD_RESET':
            return 'Pending Reset';
        default:
            return status.charAt(0) + status.slice(1).toLowerCase();
    }
}

export function UsersTable({ users }: UsersTableProps) {
    if (users.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">No users found</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Login</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map(user => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                    {user.role}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getStatusBadgeVariant(user.status)}>
                                    {formatStatus(user.status)}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(user.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(user.lastLoginAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
