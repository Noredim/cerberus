import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'ghost' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

    const variants = {
        primary: 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-sm',
        ghost: 'bg-transparent text-text-muted hover:bg-bg-deep hover:text-text-primary',
        outline: 'bg-transparent border border-border-subtle text-text-primary hover:bg-bg-deep',
        danger: 'bg-brand-danger text-white hover:bg-brand-danger/90 shadow-sm',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        icon: 'p-2',
        'icon-sm': 'p-1',
    };

    const variantStyle = variants[variant] || variants.primary;
    const sizeStyle = sizes[size] || sizes.md;

    return (
        <button
            className={`${baseStyles} ${variantStyle} ${sizeStyle} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
