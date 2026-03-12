import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'neutral',
    className = ''
}) => {
    const variants = {
        success: 'bg-brand-success/10 text-brand-success border-brand-success/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        danger: 'bg-brand-danger/10 text-brand-danger border-brand-danger/20',
        info: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
        neutral: 'bg-bg-deep text-text-muted border-border-subtle',
    };

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
