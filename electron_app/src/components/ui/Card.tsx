import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated' | 'glass'
  hover?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'glass', hover = true, children, ...props }, ref) => {
    const baseStyles = 'relative'

    const variantStyles = {
      default: 'bg-white rounded-xl shadow-md',
      outlined: 'bg-white rounded-xl border border-gray-200',
      elevated: 'bg-white rounded-2xl shadow-lg',
      glass: 'glass-card',
    }

    const hoverStyles = hover
      ? 'hover:-translate-y-1 hover:shadow-xl transition-all duration-300'
      : ''

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
