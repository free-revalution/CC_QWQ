import { useState, useEffect } from 'react'
import {
  Shield,
  Bell,
  Check,
  X,
  Trash2,
  Loader,
} from 'lucide-react'
import { ipc } from '../../lib/ipc'
import type { UserPreferences } from '../../types/operation'

interface ApprovalPreferencesProps {
  /** 关闭回调 */
  onClose: () => void
}

/**
 * 通知级别配置
 */
const NOTIFICATION_LEVELS = [
  { value: 'all', label: '全部通知', description: '显示所有审批请求通知' },
  { value: 'risky', label: '仅风险操作', description: '只显示中高风险操作的审批请求' },
  { value: 'errors', label: '仅错误', description: '只在发生错误时显示通知' },
] as const

export function ApprovalPreferences({ onClose }: ApprovalPreferencesProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 加载偏好设置
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const result = await ipc.getApprovalPreferences()
        setPreferences(result)
      } catch (error) {
        console.error('Failed to load approval preferences:', error)
      } finally {
        setLoading(false)
      }
    }
    loadPreferences()
  }, [])

  // 更新偏好设置
  const handleUpdate = async (updates: Partial<UserPreferences>) => {
    if (!preferences) return
    setSaving(true)
    try {
      await ipc.updateApprovalPreferences(updates)
      setPreferences({ ...preferences, ...updates })
    } catch (error) {
      console.error('Failed to update approval preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  // 清除记住的选择
  const handleClearRemembered = async () => {
    setSaving(true)
    try {
      await ipc.clearRememberedChoices()
    } catch (error) {
      console.error('Failed to clear remembered choices:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !preferences) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="glass-card rounded-2xl p-8 flex items-center gap-3">
          <Loader size={20} className="animate-spin text-primary" />
          <span className="text-primary">加载设置中...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Shield size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">审批偏好设置</h2>
              <p className="text-xs text-secondary">配置 AI 操作审批行为</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-secondary" />
          </button>
        </div>

        {saving && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-sm text-blue-400">
            <Loader size={16} className="animate-spin" />
            <span>保存中...</span>
          </div>
        )}

        <div className="space-y-4">
          {/* 自动批准低风险操作 */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Check size={18} className="text-green-400" />
                  <h3 className="font-medium text-primary">自动批准低风险操作</h3>
                </div>
                <p className="text-xs text-secondary">
                  对于标记为低风险的操作（如读取文件），自动批准而无需手动确认
                </p>
              </div>
              <button
                onClick={() => handleUpdate({ autoApproveLowRisk: !preferences.autoApproveLowRisk })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.autoApproveLowRisk ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preferences.autoApproveLowRisk ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 需要确认 */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={18} className="text-blue-400" />
                  <h3 className="font-medium text-primary">需要确认</h3>
                </div>
                <p className="text-xs text-secondary">
                  对于需要批准的操作，显示审批弹窗等待用户确认
                </p>
              </div>
              <button
                onClick={() => handleUpdate({ requireConfirmation: !preferences.requireConfirmation })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.requireConfirmation ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preferences.requireConfirmation ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 记住选择 */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Bell size={18} className="text-orange-400" />
                  <h3 className="font-medium text-primary">记住选择</h3>
                </div>
                <p className="text-xs text-secondary">
                  允许记住用户的选择，相同的操作将自动应用之前的选择
                </p>
              </div>
              <button
                onClick={() => handleUpdate({ rememberChoices: !preferences.rememberChoices })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preferences.rememberChoices ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preferences.rememberChoices ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 通知级别 */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h3 className="font-medium text-primary mb-3">通知级别</h3>
            <div className="space-y-2">
              {NOTIFICATION_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    preferences.notificationLevel === level.value
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="notificationLevel"
                    value={level.value}
                    checked={preferences.notificationLevel === level.value}
                    onChange={(e) => handleUpdate({ notificationLevel: e.target.value as any })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-primary text-sm">{level.label}</div>
                    <div className="text-xs text-secondary">{level.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 清除记住的选择 */}
          <button
            onClick={handleClearRemembered}
            className="w-full p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={18} />
            清除所有记住的选择
          </button>
        </div>
      </div>
    </div>
  )
}
