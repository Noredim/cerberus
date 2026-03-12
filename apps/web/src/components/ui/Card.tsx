import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
};
