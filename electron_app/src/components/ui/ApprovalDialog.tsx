import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
} from 'lucide-react'

/**
 * 审批请求数据结构
 */
export interface ApprovalRequestData {
  requestId: string
  tool: string
  params: any
  riskLevel: 'low' | 'medium' | 'high'
  reason?: string
}

interface ApprovalDialogProps {
  /** 是否打开 */
  isOpen: boolean
  /** 审批请求数据 */
  request: ApprovalRequestData | null
  /** 响应回调 */
  onRespond: (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => void
  /** 关闭回调 */
  onClose: () => void
}

/**
 * 风险等级配置
 */
const RISK_CONFIG = {
  low: {
    color: 'border-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    icon: Shield,
    label: '低风险',
  },
  medium: {
    color: 'border-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    icon: AlertTriangle,
    label: '中风险',
  },
  high: {
    color: 'border-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    icon: AlertCircle,
    label: '高风险',
  },
}

/**
 * 工具名称映射（中文）
 */
const TOOL_NAMES: Record<string, string> = {
  browser_navigate: '浏览器导航',
  browser_click: '浏览器点击',
  browser_screenshot: '浏览器截图',
  sandbox_read_file: '读取文件',
  sandbox_write_file: '写入文件',
  system_exec: '执行系统命令',
}

export function ApprovalDialog({
  isOpen,
  request,
  onRespond,
  onClose,
}: ApprovalDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        handleDeny()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleApprove = useCallback(() => {
    if (!request) return
    onRespond(request.requestId, 'approve', showAdvanced ? 'always' : 'once')
    setShowAdvanced(false)
  }, [request, onRespond, showAdvanced])

  const handleDeny = useCallback(() => {
    if (!request) return
    onRespond(request.requestId, 'deny', 'once')
    setShowAdvanced(false)
  }, [request, onRespond])

  if (!isOpen || !request) return null

  const riskConfig = RISK_CONFIG[request.riskLevel]
  const RiskIcon = riskConfig.icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`glass-card rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl border-l-4 ${riskConfig.color}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：风险等级和工具名称 */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${riskConfig.bgColor} flex items-center justify-center`}>
            <RiskIcon size={24} className={riskConfig.textColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-primary">
                {TOOL_NAMES[request.tool] || request.tool}
              </h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskConfig.bgColor} ${riskConfig.textColor}`}>
                {riskConfig.label}
              </span>
            </div>
            <p className="text-sm text-secondary">
              AI 助手请求执行此操作
            </p>
          </div>
        </div>

        {/* 原因说明（如果有） */}
        {request.reason && (
          <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-secondary">{request.reason}</p>
          </div>
        )}

        {/* 参数详情 */}
        {request.params && Object.keys(request.params).length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-secondary mb-2">操作参数：</p>
            <div className="p-3 rounded-lg bg-black/30 border border-white/10 space-y-1">
              {Object.entries(request.params).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="text-secondary font-mono text-xs">{key}:</span>
                  <span className="text-primary font-mono text-xs truncate">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 警告提示 */}
        {request.riskLevel === 'high' && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>此操作具有高风险，请仔细检查参数后再决定</span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeny}
              className="flex-1 px-4 py-2.5 rounded-xl glass-button flex items-center justify-center gap-2 text-sm font-medium text-secondary hover:text-red-400 transition-colors"
            >
              <X size={18} />
              拒绝
            </button>
            <button
              onClick={handleApprove}
              className={`flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-lg ${
                request.riskLevel === 'high' ? 'shadow-red-500/30' : 'shadow-blue-500/30'
              }`}
            >
              <Check size={18} />
              {showAdvanced ? '允许且不再询问' : '允许一次'}
            </button>
          </div>

          {/* 高级选项切换 */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2 rounded-xl text-xs text-secondary hover:text-primary transition-colors"
          >
            {showAdvanced ? '返回基础选项' : '显示高级选项...'}
          </button>

          {/* 高级选项：记住选择 */}
          {showAdvanced && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <label className="flex items-start gap-2 text-sm text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setShowAdvanced(true)
                    }
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-primary font-medium">记住我的选择</span>
                  {' '} - 对于相同的工具和参数组合，将自动允许而不再询问
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 快捷键提示 */}
        <div className="mt-4 text-center text-xs text-secondary">
          <span className="px-2 py-1 rounded bg-white/5">Esc 拒绝</span>
        </div>
      </div>
    </div>
  )
}
