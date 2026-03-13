'use client';

import { BarChart3, Boxes, ChevronUp, Key, KeyRound, LogOut, MessageCircle, MessageSquare, ScrollText, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SessionUser } from '@/lib/auth/jwt';
import { cn } from '@/lib/utils';

interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    basePath?: string;
    children?: NavItem[];
}

const navigation: NavItem[] = [
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    {
        name: 'Playground',
        href: '/playground/chat',
        icon: MessageSquare,
        basePath: '/playground',
        children: [
            { name: 'Chat', href: '/playground/chat', icon: MessageCircle },
            { name: 'Embeddings', href: '/playground/embeddings', icon: Boxes },
        ],
    },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    {
        name: 'Logs',
        href: '/logs/chat',
        icon: ScrollText,
        basePath: '/logs',
        children: [
            { name: 'Chat', href: '/logs/chat', icon: MessageCircle },
            { name: 'Embeddings', href: '/logs/embeddings', icon: Boxes },
        ],
    },
];

const adminNavigation: NavItem[] = [
    { name: 'Users', href: '/users', icon: Users },
];

interface SidebarProps {
    user: SessionUser;
}

export function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    function handleChangePassword() {
        router.push('/reset-password');
    }

    const allNavigation = user.role === 'ADMIN'
        ? [...navigation, ...adminNavigation]
        : navigation;

    // Get user initials for avatar
    const initials = user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 border-b px-6">
                <Zap className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">Synapse</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {allNavigation.map((item) => {
                    if (item.children) {
                        const groupBase = item.basePath ?? item.href;
                        const isGroupActive = pathname.startsWith(groupBase);
                        return (
                            <div key={item.name}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isGroupActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                </Link>
                                {isGroupActive && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {item.children.map((child) => {
                                            const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
                                            return (
                                                <Link
                                                    key={child.name}
                                                    href={child.href}
                                                    className={cn(
                                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                                        isChildActive
                                                            ? 'bg-accent text-accent-foreground'
                                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                                    )}
                                                >
                                                    <child.icon className="h-4 w-4" />
                                                    {child.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="border-t p-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                {initials}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={handleChangePassword}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Change Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
