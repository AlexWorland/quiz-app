import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
export const Button = React.forwardRef(({ variant = 'primary', size = 'md', loading = false, className = '', disabled, ...props }, ref) => {
    const baseStyles = 'font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
    const variantStyles = {
        primary: 'bg-accent-cyan text-dark-900 hover:bg-opacity-90',
        secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };
    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };
    return (_jsx("button", { ref: ref, disabled: disabled || loading, className: `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`, ...props, children: loading ? '...' : props.children }));
});
Button.displayName = 'Button';
