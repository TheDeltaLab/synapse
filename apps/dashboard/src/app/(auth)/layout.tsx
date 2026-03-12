import { Zap } from 'lucide-react';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <div className="flex items-center gap-2">
                        <Zap className="h-8 w-8 text-primary" />
                        <span className="text-2xl font-bold">Synapse</span>
                    </div>
                </div>
                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    {children}
                </div>
            </div>
        </div>
    );
}
