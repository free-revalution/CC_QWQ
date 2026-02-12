import { useState, useEffect, useCallback } from 'react'
import { Shield, AlertCircle, Check, X, MessageSquare } from 'lucide-react'

/**
 * 权限请求数据结构
 */
export interface PermissionRequestData {
  conversationId: string
  projectPath: string
  toolName: string
  details: string
  promptType?: 'edit' | 'write' | 'generic' | 'tool-permission'
  options?: string[]
  question?: string
  filterMode: 'develop' | 'talk'
}

interface PermissionRequestDialogProps {
  /** 是否打开 */
  isOpen: boolean
  /** 权限请求数据 */
  request: PermissionRequestData | null
  /** 响应回调 */
  onRespond: (conversationId: string, choice: string) => void
  /** 关闭回调 */
  onClose: () => void
}

/**
 * 工具名称映射（中文）
 */
const TOOL_NAMES: Record<string, string> = {
  'web-search-prime': '网络搜索',
  'webSearchPrime': '网络搜索',
  'Bash': '执行命令',
  'Read': '读取文件',
  'Write': '写入文件',
  'Edit': '编辑文件',
  'MultiEdit': '批量编辑',
  'Glob': '搜索文件',
  'Grep': '搜索内容',
  'WebFetch': '获取网页',
  'Task': '执行任务',
  'unknown': '工具',
}

/**
 * 将选项文本转换为简短显示
 */
function shortenOption(option: string): string {
  if (option === 'Yes') return 'Yes'
  if (option.startsWith('Yes, and don\'t ask again')) return 'Yes, and don\'t ask again'
  if (option === '__INPUT__') return 'Type custom response...'
  return option.length > 60 ? option.slice(0, 60) + '...' : option
}

export function PermissionRequestDialog({
  isOpen,
  request,
  onRespond,
  onClose,
}: PermissionRequestDialogProps) {
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const handleOptionClick = useCallback((option: string) => {
    if (!request) return

    if (option === '__INPUT__') {
      setShowCustomInput(true)
      return
    }

    onRespond(request.conversationId, option)
    setCustomInput('')
    setShowCustomInput(false)
  }, [request, onRespond])

  const handleCustomSubmit = useCallback(() => {
    if (!request || !customInput.trim()) return
    onRespond(request.conversationId, customInput.trim())
    setCustomInput('')
    setShowCustomInput(false)
  }, [request, customInput, onRespond])

  const handleCancel = useCallback(() => {
    if (!request) return
    onClose()
    setCustomInput('')
    setShowCustomInput(false)
  }, [request, onClose])

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleCancel])

  if (!isOpen || !request) return null

  const isDevelopMode = request.filterMode === 'develop'
  const hasOptions = request.options && request.options.length > 0
  const toolDisplayName = TOOL_NAMES[request.toolName] || request.toolName

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        className="glass-card rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl border-l-4 border-blue-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Shield size={24} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-primary">
                {toolDisplayName}
              </h3>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400">
                Permission Required
              </span>
            </div>
            <p className="text-sm text-secondary">
              {request.question || 'Do you want to proceed?'}
            </p>
          </div>
        </div>

        {/* 详情 */}
        {request.details && (
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 max-h-32 overflow-y-auto">
            <p className="text-xs text-secondary font-mono whitespace-pre-wrap break-words">
              {request.details.slice(0, 500)}
            </p>
          </div>
        )}

        {/* Develop 模式：显示交互式选项 */}
        {isDevelopMode && hasOptions && !showCustomInput && (
          <div className="space-y-2 mb-4">
            {request.options!.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                className="w-full px-4 py-3 rounded-xl text-left text-sm transition-all
                  bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20
                  text-primary flex items-center gap-3"
              >
                {option === '__INPUT__' ? (
                  <>
                    <MessageSquare size={18} className="text-secondary flex-shrink-0" />
                    <span className="text-secondary">Type custom response...</span>
                  </>
                ) : option === 'Yes' ? (
                  <>
                    <Check size={18} className="text-green-400 flex-shrink-0" />
                    <span>{shortenOption(option)}</span>
                  </>
                ) : option.startsWith('Yes, and don\'t ask again') ? (
                  <>
                    <Check size={18} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs">{shortenOption(option)}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={18} className="text-orange-400 flex-shrink-0" />
                    <span>{shortenOption(option)}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 自定义输入框 */}
        {showCustomInput && (
          <div className="mb-4 space-y-3">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Type your custom response..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-primary placeholder-secondary text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomInput(false)}
                className="flex-1 px-4 py-2.5 rounded-xl glass-button text-sm text-secondary"
              >
                Back
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customInput.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600
                  text-white text-sm font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Talk 模式：只显示文本信息和简单按钮 */}
        {(!isDevelopMode || !hasOptions) && !showCustomInput && (
          <div className="space-y-2 mb-4">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-orange-300">
                In Talk mode, permission options are not interactive.
                Switch to Develop mode for interactive options.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-xl glass-button text-sm text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOptionClick('Yes')}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600
                  text-white text-sm font-medium transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        )}

        {/* 取消按钮（仅在 Develop 模式有选项时显示） */}
        {isDevelopMode && hasOptions && !showCustomInput && (
          <button
            onClick={handleCancel}
            className="w-full px-4 py-2.5 rounded-xl glass-button text-sm text-secondary
              flex items-center justify-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
        )}

        {/* 快捷键提示 */}
        <div className="mt-4 text-center text-xs text-secondary">
          <span className="px-2 py-1 rounded bg-white/5">Esc to cancel</span>
        </div>
      </div>
    </div>
  )
}
