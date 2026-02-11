/**
 * Bot Settings Component
 *
 * Configuration UI for WhatsApp/Feishu bot integration
 */

import { useState } from 'react'
import { MessageSquare, Check, X, RefreshCw, Settings2 } from 'lucide-react'
import Card from './Card'

interface BotConfig {
  whatsapp: {
    enabled: boolean
    connected: boolean
    conversationId?: string
  }
  feishu: {
    enabled: boolean
    connected: boolean
    conversationId?: string
  }
}

interface BotSettingsProps {
  onConfigChange?: (config: BotConfig) => void
}

export default function BotSettings({ onConfigChange }: BotSettingsProps) {
  const [config, setConfig] = useState<BotConfig>(() => {
    try {
      const stored = localStorage.getItem('ccqwq_bot_config')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Return default
    }
    return {
      whatsapp: { enabled: false, connected: false },
      feishu: { enabled: false, connected: false },
    }
  })

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [statusCheck, setStatusCheck] = useState(false)

  // Save config to localStorage and notify parent
  const saveConfig = async (newConfig: BotConfig) => {
    setSaving(true)
    setSaved(false)

    try {
      localStorage.setItem('ccqwq_bot_config', JSON.stringify(newConfig))
      setConfig(newConfig)
      onConfigChange?.(newConfig)

      // Show saved confirmation
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save bot config:', error)
    } finally {
      setSaving(false)
    }
  }

  // Check bot connection status
  const checkStatus = async () => {
    setStatusCheck(true)
    // TODO: Implement actual status check via IPC
    setTimeout(() => {
      setStatusCheck(false)
    }, 1000)
  }

  const toggleWhatsApp = () => {
    saveConfig({
      ...config,
      whatsapp: { ...config.whatsapp, enabled: !config.whatsapp.enabled },
    })
  }

  const toggleFeishu = () => {
    saveConfig({
      ...config,
      feishu: { ...config.feishu, enabled: !config.feishu.enabled },
    })
  }

  return (
    <Card className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-full blur-2xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-blue-500/20">
              <MessageSquare size={18} className="text-green-500 sm:size-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-primary">Bot Integration</h3>
              <p className="text-xs sm:text-sm text-secondary">Connect WhatsApp/Feishu for remote Claude access</p>
            </div>
          </div>
          <button
            onClick={checkStatus}
            className="p-2 rounded-xl glass-button group/btn disabled:opacity-50"
            title="Check connection status"
            disabled={statusCheck}
          >
            <RefreshCw size={16} className={statusCheck ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform sm:size-[18px]'} />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {/* WhatsApp Section */}
          <div className="p-3 sm:p-4 rounded-xl glass-card border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.whatsapp.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                <div>
                  <h4 className="text-sm font-semibold text-primary">WhatsApp Bot</h4>
                  <p className="text-xs text-secondary">
                    {config.whatsapp.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleWhatsApp}
                className={`relative w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors duration-200 ${
                  config.whatsapp.enabled ? 'bg-green-500/30' : 'bg-gray-600/30'
                }`}
              >
                <div
                  className={`absolute top-0.5 sm:top-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    config.whatsapp.enabled ? 'translate-x-6 sm:translate-x-7' : 'translate-x-0.5 sm:translate-x-1'
                  }`}
                >
                  {config.whatsapp.enabled ? (
                    <Check size={14} className="text-green-600 sm:mt-0.5 sm:mt-1 sm:ml-0.5" />
                  ) : (
                    <X size={14} className="text-gray-500 sm:mt-0.5 sm:mt-1 sm:ml-0.5" />
                  )}
                </div>
              </button>
            </div>

            {config.whatsapp.enabled && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <label className="text-xs text-secondary uppercase tracking-wider mb-2 block font-semibold">
                  Conversation ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.whatsapp.conversationId || ''}
                  onChange={(e) => saveConfig({
                    ...config,
                    whatsapp: { ...config.whatsapp, conversationId: e.target.value || undefined },
                  })}
                  placeholder="e.g., conv-1234567890"
                  className="w-full px-3 py-2 glass-card border-0 text-xs sm:text-sm text-primary placeholder:text-secondary/60 font-mono"
                />
              </div>
            )}
          </div>

          {/* Feishu Section */}
          <div className="p-3 sm:p-4 rounded-xl glass-card border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.feishu.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                <div>
                  <h4 className="text-sm font-semibold text-primary">Feishu Bot</h4>
                  <p className="text-xs text-secondary">
                    {config.feishu.connected ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleFeishu}
                className={`relative w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors duration-200 ${
                  config.feishu.enabled ? 'bg-green-500/30' : 'bg-gray-600/30'
                }`}
              >
                <div
                  className={`absolute top-0.5 sm:top-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    config.feishu.enabled ? 'translate-x-6 sm:translate-x-7' : 'translate-x-0.5 sm:translate-x-1'
                  }`}
                >
                  {config.feishu.enabled ? (
                    <Check size={14} className="text-green-600 sm:mt-0.5 sm:mt-1 sm:ml-0.5" />
                  ) : (
                    <X size={14} className="text-gray-500 sm:mt-0.5 sm:mt-1 sm:ml-0.5" />
                  )}
                </div>
              </button>
            </div>

            {config.feishu.enabled && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <label className="text-xs text-secondary uppercase tracking-wider mb-2 block font-semibold">
                  Conversation ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.feishu.conversationId || ''}
                  onChange={(e) => saveConfig({
                    ...config,
                    feishu: { ...config.feishu, conversationId: e.target.value || undefined },
                  })}
                  placeholder="e.g., conv-1234567890"
                  className="w-full px-3 py-2 glass-card border-0 text-xs sm:text-sm text-primary placeholder:text-secondary/60 font-mono"
                />
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="p-3 sm:p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-start gap-2">
              <Settings2 size={16} className="text-blue-500 mt-0.5 sm:mt-1 flex-shrink-0" />
              <div className="text-xs sm:text-sm text-secondary">
                <p className="font-medium text-blue-400 mb-1">How to use:</p>
                <ul className="space-y-1 text-secondary/80">
                  <li>1. Enable the desired bot platform</li>
                  <li>2. Link a conversation ID from your active Claude conversation</li>
                  <li>3. Use commands like /status, /help from the chat</li>
                  <li>4. Approve permissions with /approve or /deny</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Save Indicator */}
        {saving && (
          <div className="mt-3 text-xs text-secondary animate-pulse">
            Saving configuration...
          </div>
        )}
        {saved && (
          <div className="mt-3 flex items-center gap-1.5 text-green-600 text-xs font-medium animate-pulse">
            <Check size={12} />
            Configuration saved
          </div>
        )}
      </div>
    </Card>
  )
}
