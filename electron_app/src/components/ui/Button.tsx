import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'glass'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'glass',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      loading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'

    const variantStyles = {
      default: 'glass-button',
      primary: 'glass-button glass-button-primary',
      secondary: 'glass-button bg-gray-100/80',
      ghost: 'glass-button bg-transparent border-transparent shadow-none',
      glass: 'glass-button',
    }

    const sizeStyles = {
      sm: 'px-4 py-2 text-sm rounded-lg min-h-[40px]',
      md: 'px-6 py-3 text-base rounded-xl min-h-[48px]',
      lg: 'px-8 py-4 text-lg rounded-2xl min-h-[56px]',
    }

    const iconSize = {
      sm: 16,
      md: 18,
      lg: 20,
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : Icon && iconPosition === 'left' ? (
          <Icon size={iconSize[size]} />
        ) : null}

        {children}

        {!loading && Icon && iconPosition === 'right' ? (
          <Icon size={iconSize[size]} />
        ) : null}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
