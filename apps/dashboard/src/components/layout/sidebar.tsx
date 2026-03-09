'use client';

import { MessageSquare, Key, Zap, BarChart3, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
    { name: 'Playground', href: '/playground', icon: MessageSquare },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Logs', href: '/logs', icon: ScrollText },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col border-r bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 border-b px-6">
                <Zap className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">Synapse</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {navigation.map((item) => {
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

            {/* Footer */}
            <div className="border-t p-4">
                <p className="text-xs text-muted-foreground">
                    Synapse AI Gateway
                </p>
            </div>
        </div>
    );
}
