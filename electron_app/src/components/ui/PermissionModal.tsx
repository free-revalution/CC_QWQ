import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  FileText,
  Terminal,
  Globe,
  Clipboard,
  Bell,
  HelpCircle,
  Check,
  X,
  Smartphone,
  Monitor,
  Ban,
} from 'lucide-react'
import type { PermissionRequest, PermissionResponse, PermissionChoice } from '../../types'

interface PermissionModalProps {
  /** 权限请求 */
  request: PermissionRequest | null
  /** 处理响应 */
  onResponse: (response: PermissionResponse) => void
  /** 关闭弹窗 */
  onClose: () => void
}

/** 权限类型对应的图标 */
const PERMISSION_ICONS: Record<string, React.ReactNode> = {
  file_read: <FileText size={24} className="text-blue-500" />,
  file_write: <FileText size={24} className="text-orange-500" />,
  file_edit: <FileText size={24} className="text-yellow-500" />,
  execute_command: <Terminal size={24} className="text-red-500" />,
  network_request: <Globe size={24} className="text-green-500" />,
  clipboard_access: <Clipboard size={24} className="text-purple-500" />,
  notification: <Bell size={24} className="text-yellow-500" />,
  user_confirmation: <HelpCircle size={24} className="text-cyan-500" />,
  file_search: <FileText size={24} className="text-cyan-500" />,
  content_search: <FileText size={24} className="text-teal-500" />,
}

/** 权限类型对应的标题（默认） */
const DEFAULT_TITLES: Record<string, string> = {
  file_read: '文件读取权限',
  file_write: '文件写入权限',
  file_edit: '文件编辑权限',
  execute_command: '命令执行权限',
  network_request: '网络请求权限',
  clipboard_access: '剪贴板访问权限',
  notification: '通知权限',
  user_confirmation: '用户确认',
  file_search: '文件搜索权限',
  content_search: '内容搜索权限',
}

export default function PermissionModal({
  request,
  onResponse,
  onClose,
}: PermissionModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [showAlwaysOptions, setShowAlwaysOptions] = useState(false)

  // 处理响应
  const handleResponse = useCallback(
    (choice: PermissionChoice) => {
      if (!request) return
      setIsClosing(true)
      onResponse({
        requestId: request.id,
        choice,
        timestamp: Date.now(),
        source: 'desktop',
      })
      setTimeout(() => {
        setIsClosing(false)
        setShowAlwaysOptions(false)
        onClose()
      }, 300)
    },
    [request, onResponse, onClose]
  )

  // 处理批准
  const handleApprove = useCallback(() => {
    handleResponse('yes')
  }, [handleResponse])

  // 处理始终批准
  const handleAlwaysApprove = useCallback(() => {
    handleResponse('yesAlways')
  }, [handleResponse])

  // 处理拒绝
  const handleDeny = useCallback(() => {
    handleResponse('no')
  }, [handleResponse])

  // 处理始终拒绝
  const handleAlwaysDeny = useCallback(() => {
    handleResponse('noAlways')
  }, [handleResponse])

  // 处理退出
  const handleExit = useCallback(() => {
    handleResponse('exit')
  }, [handleResponse])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!request) return
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApprove()
      } else if (e.key === 'Escape') {
        handleDeny()
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowAlwaysOptions((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [request, handleApprove, handleDeny])

  if (!request) return null

  const icon = PERMISSION_ICONS[request.type] || PERMISSION_ICONS.user_confirmation
  const isFromMobile = request.source === 'mobile'
  const isCommand = request.type === 'execute_command'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={onClose}
    >
      <div
        className={`glass-card rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-primary truncate">
                {request.title || DEFAULT_TITLES[request.type]}
              </h3>
              {isFromMobile && (
                <Smartphone size={16} className="text-secondary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-secondary">{request.description}</p>
          </div>
        </div>

        {/* 资源路径 */}
        {request.resourcePath && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-black/20 border border-white/10">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={14} className="text-secondary flex-shrink-0" />
              <span className="text-secondary font-mono text-xs truncate">
                {request.resourcePath}
              </span>
            </div>
          </div>
        )}

        {/* 命令内容（对于 Bash 工具） */}
        {request.command && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-black/20 border border-white/10">
            <div className="flex items-center gap-2 text-sm">
              <Terminal size={14} className="text-secondary flex-shrink-0" />
              <span className="text-secondary font-mono text-xs truncate">
                {request.command}
              </span>
            </div>
          </div>
        )}

        {/* 详情列表 */}
        {request.details && request.details.length > 0 && (
          <div className="mb-4 space-y-2">
            {request.details.map((detail, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm text-secondary"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* 警告提示 */}
        {isCommand && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>此操作将执行命令，请确保您了解其潜在影响</span>
            </div>
          </div>
        )}

        {/* 来源设备指示 */}
        <div className="mb-4 flex items-center gap-2 text-xs text-secondary">
          {isFromMobile ? (
            <>
              <Smartphone size={14} />
              <span>请求来自移动设备</span>
            </>
          ) : (
            <>
              <Monitor size={14} />
              <span>本地请求</span>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        {!showAlwaysOptions ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeny}
                className="flex-1 px-4 py-2.5 rounded-xl glass-button flex items-center justify-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
              >
                <X size={18} />
                不允许
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-500/30"
              >
                <Check size={18} />
                允许
              </button>
            </div>
            <button
              onClick={() => setShowAlwaysOptions(true)}
              className="w-full px-4 py-2 rounded-xl text-xs text-secondary hover:text-primary transition-colors"
            >
              显示更多选项...
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleAlwaysApprove}
              className="w-full px-4 py-2.5 rounded-xl glass-button flex items-center justify-center gap-2 text-sm font-medium text-green-400 hover:bg-green-500/10 transition-colors"
            >
              <Check size={18} />
              始终允许
            </button>
            <button
              onClick={handleAlwaysDeny}
              className="w-full px-4 py-2.5 rounded-xl glass-button flex items-center justify-center gap-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Ban size={18} />
              始终不允许
            </button>
            <button
              onClick={handleExit}
              className="w-full px-4 py-2.5 rounded-xl glass-button flex items-center justify-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
            >
              退出对话
            </button>
            <button
              onClick={() => setShowAlwaysOptions(false)}
              className="w-full px-4 py-2 rounded-xl text-xs text-secondary hover:text-primary transition-colors"
            >
              返回基础选项
            </button>
          </div>
        )}

        {/* 快捷键提示 */}
        <div className="mt-4 text-center text-xs text-secondary">
          <span className="px-2 py-1 rounded bg-white/5">Enter 允许</span>
          <span className="mx-2">•</span>
          <span className="px-2 py-1 rounded bg-white/5">Esc 不允许</span>
        </div>
      </div>
    </div>
  )
}
