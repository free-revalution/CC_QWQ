/**
 * Status Indicator Component
 *
 * Shows the status of a Claude conversation with a colored dot
 */

interface StatusIndicatorProps {
  status: 'not_started' | 'initializing' | 'ready'
  size?: 'sm' | 'md'
}

export default function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2'
  }

  const colors = {
    not_started: 'bg-gray-500',
    initializing: 'bg-yellow-500 animate-pulse',
    ready: 'bg-green-500'
  }

  return (
    <div className={`${sizes[size]} rounded-full ${colors[status]}`} />
  )
}
