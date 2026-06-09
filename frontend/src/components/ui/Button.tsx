import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'golden-orange' | 'light-blue';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', className = '', children, type = 'button', ...props }) => {
  const base = 'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  // Use standard Tailwind palette to ensure visibility even without custom theme tokens.
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    'golden-orange': 'bg-orange-100 text-orange-900 hover:bg-orange-200 border border-orange-300',
    'light-blue': 'bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300',
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
