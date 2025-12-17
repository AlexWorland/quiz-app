import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export const Input = React.forwardRef(({ label, error, className = '', ...props }, ref) => {
    return (_jsxs("div", { className: "w-full", children: [label && (_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: label })), _jsx("input", { ref: ref, className: `
            w-full px-4 py-2 border border-gray-300 dark:border-gray-600
            rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-accent-cyan
            disabled:bg-gray-100 dark:disabled:bg-dark-700
            transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `, ...props }), error && (_jsx("p", { className: "text-red-500 text-sm mt-1", children: error }))] }));
});
Input.displayName = 'Input';
