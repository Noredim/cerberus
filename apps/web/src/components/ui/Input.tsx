import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
    return (
        <input
            className={`w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all ${className}`}
            {...props}
        />
    );
};
