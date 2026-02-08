import { useState, useEffect, useCallback } from 'react'
import { X, Zap, Clock, Server, Check, Loader2 } from 'lucide-react'
import { ipc } from '../../lib/ipc'

interface ModelSettingsProps {
  onClose: () => void
}

interface ModelInfo {
  id: string
  name: string
  provider: string
  version: string
  maxRequests?: number
  maxTokens?: number
}

interface UsageInfo {
  requestsUsed: number
  requestsLimit: number
  tokensUsed: number
  tokensLimit: number
  resetTime: number
}

interface ClaudeConfig {
  models?: ModelInfo[]
  currentModel?: string
  apiKey?: string
  provider?: string
}

export default function ModelSettings({ onClose }: ModelSettingsProps) {
  const [currentModel, setCurrentModel] = useState<ModelInfo>({
    id: 'glm-4.7',
    name: 'GLM-4.7',
    provider: 'Zhipu AI',
    version: '4.7',
    maxRequests: 100,
    maxTokens: 128000,
  })
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [usage, setUsage] = useState<UsageInfo>({
    requestsUsed: 0,
    requestsLimit: 100,
    tokensUsed: 0,
    tokensLimit: 5000000,
    resetTime: Date.now() + 5 * 60 * 60 * 1000,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [switchingModelId, setSwitchingModelId] = useState<string | null>(null)

  // 获取当前模型和使用情况
  const loadModelInfo = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    try {
      // 读取 Claude Code 配置
      console.log('Reading Claude config...')
      const configResult = await window.electronAPI?.readClaudeConfig()
      console.log('Config result:', configResult)

      if (configResult?.success && configResult.config) {
        const config = configResult.config as ClaudeConfig
        console.log('Parsed config:', config)
        if (config.models && config.models.length > 0) {
          setAvailableModels(config.models)
          const current = config.models.find((m: ModelInfo) => m.id === config.currentModel) || config.models[0]
          setCurrentModel(current)
          console.log('Set current model:', current)
        } else {
          console.log('No models found in config, using defaults')
        }
      } else {
        console.log('Failed to read config or no config available, using defaults')
      }

      // 获取用量信息
      console.log('Reading API usage...')
      const usageResult = await window.electronAPI?.getAPIUsage()
      console.log('Usage result:', usageResult)
      if (usageResult?.success && usageResult.usage) {
        setUsage(usageResult.usage as UsageInfo)
      } else {
        console.log('Failed to read usage, keeping defaults')
      }
    } catch (error) {
      console.error('Failed to load model info:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadModelInfo()
  }, [loadModelInfo])

  // 切换模型
  const handleSwitchModel = useCallback(async (modelId: string) => {
    if (modelId === currentModel.id) return

    setSwitchingModelId(modelId)
    try {
      const result = await ipc.switchModel(modelId)
      if (result.success) {
        // 重新加载模型信息
        await loadModelInfo(true)
      } else {
        console.error('Failed to switch model:', result.error)
        alert(`切换模型失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      console.error('Failed to switch model:', error)
      alert('切换模型失败')
    } finally {
      setSwitchingModelId(null)
    }
  }, [currentModel.id, loadModelInfo])

  // 计算时间剩余
  const getTimeRemaining = useCallback(() => {
    const now = Date.now()
    const diff = usage.resetTime - now
    if (diff <= 0) return '已重置'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}小时${minutes}分钟`
  }, [usage.resetTime])

  // 计算使用百分比
  const getUsagePercentage = useCallback((used: number, limit: number) => {
    if (limit === 0) return 0
    return Math.min((used / limit) * 100, 100)
  }, [])

  // 获取进度条颜色
  const getProgressColor = useCallback((percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }, [])

  const requestsPercentage = getUsagePercentage(usage.requestsUsed, usage.requestsLimit)
  const tokensPercentage = getUsagePercentage(usage.tokensUsed, usage.tokensLimit)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card rounded-2xl p-6 w-full mx-4 shadow-2xl animate-fadeIn flex flex-col"
        style={{ maxHeight: '80vh', maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Zap size={20} className="text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">模型设置</h2>
              <p className="text-sm text-secondary">当前使用的 AI 模型</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* 可滚动内容区域 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
                <p className="text-sm text-secondary">加载中...</p>
              </div>
            </div>
          ) : (
            <>
              {/* 当前模型信息 */}
              <div className="mb-6 p-4 rounded-xl bg-black/20 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server size={18} className="text-secondary" />
                    <span className="text-sm font-medium text-primary">当前模型</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                    在线
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary">模型</span>
                    <span className="text-sm font-medium text-primary">{currentModel.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary">提供商</span>
                    <span className="text-sm font-medium text-primary">{currentModel.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-secondary">版本</span>
                    <span className="text-sm font-medium text-primary">{currentModel.version}</span>
                  </div>
                </div>
              </div>

              {/* 使用情况 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-primary mb-4 flex items-center gap-2">
                  <Clock size={16} />
                  使用情况
                </h3>

                {/* 请求次数 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-secondary">请求次数 (5小时)</span>
                    <span className="text-primary font-medium">
                      {usage.requestsUsed} / {usage.requestsLimit}
                    </span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(requestsPercentage)} transition-all duration-500`}
                      style={{ width: `${requestsPercentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary mt-1">
                    重置时间：{getTimeRemaining()}
                  </div>
                </div>

                {/* Token 使用 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-secondary">Token 用量 (每月)</span>
                    <span className="text-primary font-medium">
                      {(usage.tokensUsed / 10000).toFixed(1)}万 / {(usage.tokensLimit / 10000).toFixed(1)}万
                    </span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(tokensPercentage)} transition-all duration-500`}
                      style={{ width: `${tokensPercentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary mt-1">
                    MCP 用量进度
                  </div>
                </div>
              </div>

              {/* 可用模型列表 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-primary mb-3">可用模型</h3>
                <div className="space-y-2">
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => {
                      const isCurrent = model.id === currentModel.id
                      const isSwitching = switchingModelId === model.id
                      return (
                        <button
                          key={model.id}
                          disabled={isCurrent || isSwitching}
                          onClick={() => handleSwitchModel(model.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            isCurrent
                              ? 'bg-purple-500/10 border-purple-500/30'
                              : 'bg-black/20 border-white/10 hover:bg-white/10'
                          } ${isSwitching ? 'opacity-70 cursor-wait' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-primary">{model.name}</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-500 text-xs">
                                    当前
                                  </span>
                                )}
                                {isSwitching && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 text-xs flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" />
                                    切换中
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-secondary mt-0.5">{model.provider}</div>
                            </div>
                            {isCurrent && <Check size={16} className="text-purple-500" />}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="text-center py-8 text-secondary text-sm">
                      未找到可用模型，请检查 Claude Code 配置
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 mt-6 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl glass-button text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => loadModelInfo(true)}
            disabled={isRefreshing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-purple-500/30 hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRefreshing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                刷新中...
              </>
            ) : (
              '刷新数据'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
