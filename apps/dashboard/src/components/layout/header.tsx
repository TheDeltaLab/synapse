interface HeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
    return (
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
            <div>
                <h1 className="text-2xl font-semibold">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
    );
}
