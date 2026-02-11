/**
 * ToolCallView - 工具调用展示组件
 *
 * 参考: https://github.com/slopus/happy
 *
 * 显示 Claude Code 工具调用的状态、输入和结果
 */

import { Check, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ToolCall, ToolCallState } from '../../types/message'

interface ToolCallViewProps {
  tool: ToolCall
  expanded?: boolean
}

// 状态颜色映射
const stateColors: Record<ToolCallState, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    border: 'border-yellow-500/20'
  },
  running: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20'
  },
  completed: {
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    border: 'border-green-500/20'
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20'
  }
}

// 状态文本映射
const stateLabels: Record<ToolCallState, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  error: '失败'
}

export default function ToolCallView({ tool, expanded: defaultExpanded = false }: ToolCallViewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const colors = stateColors[tool.state]
  const hasPermission = !!tool.permission
  const hasResult = tool.result !== undefined

  // 格式化输入参数
  const formatInput = (input: any): string => {
    if (!input) return ''
    if (typeof input === 'string') return input
    if (typeof input === 'object') {
      return Object.entries(input)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')
    }
    return String(input)
  }

  // 格式化结果
  const formatResult = (result: any): string => {
    if (!result) return ''
    if (typeof result === 'string') return result
    return JSON.stringify(result, null, 2)
  }

  return (
    <div
      className={`
        rounded-lg border transition-all duration-200
        ${colors.bg} ${colors.border}
      `}
    >
      {/* Header - 总是可见 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
      >
        {/* 展开/收起图标 */}
        <span className="text-secondary">
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>

        {/* 状态指示器 */}
        <span className={`flex-shrink-0 w-2 h-2 rounded-full ${colors.text}`} />

        {/* 工具名称 */}
        <span className="text-sm font-medium text-primary flex-1">
          {tool.name}
        </span>

        {/* 描述（如果有） */}
        {tool.description && (
          <span className="text-xs text-secondary truncate max-w-[200px]">
            {tool.description}
          </span>
        )}

        {/* 状态标签 */}
        <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {stateLabels[tool.state]}
        </span>

        {/* 运行中动画 */}
        {tool.state === 'running' && (
          <Loader2 size={14} className={`${colors.text} animate-spin`} />
        )}

        {/* 完成图标 */}
        {tool.state === 'completed' && (
          <Check size={14} className={colors.text} />
        )}

        {/* 错误图标 */}
        {tool.state === 'error' && (
          <X size={14} className={colors.text} />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* 输入参数 */}
          <div className="bg-black/20 rounded p-2">
            <div className="text-xs text-secondary mb-1">输入参数</div>
            <pre className="text-xs text-primary overflow-x-auto whitespace-pre-wrap font-mono">
              {formatInput(tool.input)}
            </pre>
          </div>

          {/* 权限信息（如果有） */}
          {hasPermission && (
            <div className={`rounded p-2 border ${colors.border}`}>
              <div className="text-xs text-secondary mb-1">权限决策</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={colors.text}>
                  {tool.permission?.status === 'approved' && <Check size={12} />}
                  {tool.permission?.status === 'denied' && <X size={12} />}
                  {tool.permission?.status === 'pending' && <Loader2 size={12} className="animate-spin" />}
                </span>
                <span className="text-primary">
                  {tool.permission?.status === 'approved' && '已批准'}
                  {tool.permission?.status === 'denied' && '已拒绝'}
                  {tool.permission?.status === 'pending' && '等待批准'}
                </span>
                {tool.permission?.decision && (
                  <span className="text-secondary">
                    ({tool.permission.decision})
                  </span>
                )}
              </div>
              {tool.permission?.reason && (
                <div className="text-xs text-secondary mt-1">
                  原因: {tool.permission.reason}
                </div>
              )}
            </div>
          )}

          {/* 结果（如果有） */}
          {hasResult && (
            <div className="bg-black/20 rounded p-2">
              <div className="text-xs text-secondary mb-1">执行结果</div>
              {tool.state === 'error' ? (
                <pre className="text-xs text-red-400 overflow-x-auto whitespace-pre-wrap font-mono">
                  {formatResult(tool.result)}
                </pre>
              ) : (
                <pre className="text-xs text-primary overflow-x-auto whitespace-pre-wrap font-mono">
                  {formatResult(tool.result)}
                </pre>
              )}
            </div>
          )}

          {/* 时间信息 */}
          <div className="text-xs text-secondary flex items-center gap-3">
            {tool.startedAt && (
              <span>开始: {new Date(tool.startedAt).toLocaleTimeString()}</span>
            )}
            {tool.completedAt && (
              <span>
                完成: {new Date(tool.completedAt).toLocaleTimeString()} (
                  {Math.round((tool.completedAt - tool.createdAt!) / 1000)}s)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 工具调用列表视图
 */
interface ToolCallListProps {
  tools: ToolCall[]
  className?: string
}

export function ToolCallList({ tools, className = '' }: ToolCallListProps) {
  if (tools.length === 0) {
    return null
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs text-secondary px-1">工具调用 ({tools.length})</div>
      {tools.map((tool) => (
        <ToolCallView key={`${tool.name}-${tool.createdAt}`} tool={tool} />
      ))}
    </div>
  )
}
