/**
 * ActivityIndicator - 活动状态指示器组件
 *
 * 参考: https://github.com/slopus/happy
 *
 * 显示会话的实时活动状态（thinking、active）
 */

import { Loader2, Clock } from 'lucide-react'

interface ActivityIndicatorProps {
  active?: boolean
  thinking?: boolean
  activeAt?: number
  thinkingAt?: number
  className?: string
}

export default function ActivityIndicator({
  active = false,
  thinking = false,
  activeAt,
  thinkingAt,
  className = ''
}: ActivityIndicatorProps) {
  if (!active && !thinking) {
    return null
  }

  // 计算思考持续时间
  const getThinkingDuration = (): string => {
    if (!thinkingAt) return ''
    const duration = Math.floor((Date.now() - thinkingAt) / 1000)
    if (duration < 60) return `${duration}s`
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {/* 思考状态 */}
      {thinking && (
        <div className="flex items-center gap-1.5 text-blue-400">
          <Loader2 size={12} className="animate-spin" />
          <span>思考中</span>
          {thinkingAt && (
            <span className="text-secondary">({getThinkingDuration()})</span>
          )}
        </div>
      )}

      {/* 活跃但不在思考 */}
      {active && !thinking && activeAt && (
        <div className="flex items-center gap-1.5 text-green-400">
          <Clock size={12} />
          <span>活跃</span>
          <span className="text-secondary">
            ({Math.floor((Date.now() - activeAt) / 1000)}s 前)
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * 紧凑的活动状态指示点（用于会话列表）
 */
interface ActivityDotProps {
  active?: boolean
  thinking?: boolean
  className?: string
}

export function ActivityDot({ active = false, thinking = false, className = '' }: ActivityDotProps) {
  if (!active && !thinking) {
    return null
  }

  return (
    <div className={`w-2 h-2 rounded-full ${className} ${
        thinking
          ? 'bg-blue-500 animate-pulse'
          : 'bg-green-500'
      }`} />
  )
}
