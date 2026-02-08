import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  glass?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', label, error, glass = true, ...props }, ref) => {
    const baseInputStyles = 'w-full min-h-[48px] transition-all duration-300'

    const inputStyles = glass
      ? 'glass-input'
      : 'w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-sm font-medium text-primary/80">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={`${baseInputStyles} ${inputStyles} ${className}`}
          {...props}
        />
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
