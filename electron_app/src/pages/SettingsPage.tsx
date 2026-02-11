import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Copy, Check, Sparkles, QrCode, RefreshCw, MessageSquare } from 'lucide-react'
import QRCode from 'qrcode'
import Card from '../components/ui/Card'
import BotSettings from '../components/ui/BotSettings'
import ConversationDrawer from '../components/mobile/ConversationDrawer'
import { ipc } from '../lib/ipc'
import type { Settings, MobileConversation } from '../types'

// 响应式断点
const BREAKPOINTS = {
  sm: 640,   // 小屏幕
  md: 768,   // 中等屏幕
  lg: 1024,  // 大屏幕
  xl: 1280,  // 超大屏幕
}

interface SettingsPageProps {
  onBack: () => void
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  // 侧边栏状态
  const [sidebarVisible, setSidebarVisible] = useState(true)

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      // 小屏幕隐藏侧边栏
      setSidebarVisible(width >= BREAKPOINTS.lg)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem('ccqwq_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          linkPassword: parsed.linkPassword || '',
          port: parsed.port || 3000,
        }
      }
    } catch {
      // 返回默认值
    }
    return {
      linkPassword: '',
      port: 3000,
    }
  })
  const [passwordInput, setPasswordInput] = useState(settings.linkPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{ ip: string; port: number; hasPassword: boolean } | null>(null)
  const [qrCodeData, setQrCodeData] = useState<string>('')
  const [qrLoading, setQrLoading] = useState(false)

  // 移动端对话抽屉状态
  const [showConversationDrawer, setShowConversationDrawer] = useState(false)
  const [mobileConversations, setMobileConversations] = useState<MobileConversation[]>([])
  const [selectedMobileConversationId, setSelectedMobileConversationId] = useState<string | null>(null)

  useEffect(() => {
    const loadConnectionInfo = async () => {
      try {
        const info = await ipc.getConnectionInfo()
        setConnectionInfo(info)
      } catch (error) {
        console.error('Failed to get connection info:', error)
      }
    }
    loadConnectionInfo()
  }, [settings.linkPassword])

  const handleSavePassword = async () => {
    try {
      await ipc.setLinkPassword(passwordInput)
      setSettings({ ...settings, linkPassword: passwordInput })
      localStorage.setItem('ccqwq_settings', JSON.stringify({ ...settings, linkPassword: passwordInput }))
      // 重新加载连接信息
      const info = await ipc.getConnectionInfo()
      setConnectionInfo(info)
    } catch (error) {
      console.error('Failed to save password:', error)
    }
  }

  const handleCopyLink = () => {
    if (!connectionInfo) return
    const link = `ws://${connectionInfo.ip}:${connectionInfo.port}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 生成二维码
  const generateQRCode = async () => {
    if (!connectionInfo) return

    setQrLoading(true)
    try {
      const connectionUrl = `ws://${connectionInfo.ip}:${connectionInfo.port}`
      const qrData = JSON.stringify({
        url: connectionUrl,
        password: settings.linkPassword || '',
      })

      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1D1D1F',
          light: '#FFFFFF',
        },
      })

      setQrCodeData(dataUrl)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    } finally {
      setQrLoading(false)
    }
  }

  // 加载移动端对话列表
  const loadMobileConversations = useCallback(async () => {
    try {
      const result = await ipc.getConversationList()
      if (result.success && result.conversations) {
        setMobileConversations(result.conversations)
        console.log('[Mobile] Loaded', result.conversations.length, 'conversations')
      }
    } catch (error) {
      console.error('[Mobile] Failed to load conversations:', error)
    }
  }, [])

  // 定期刷新对话列表
  useEffect(() => {
    loadMobileConversations()
    const interval = setInterval(loadMobileConversations, 5000)
    return () => clearInterval(interval)
  }, [loadMobileConversations])

  // 当连接信息变化时重新生成二维码
  useEffect(() => {
    if (connectionInfo) {
      generateQRCode()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionInfo, settings.linkPassword]) // generateQRCode is stable, doesn't need to be in deps

  if (!connectionInfo) {
    return (
      <div className="h-full w-full flex bg-background/50 relative">
        {/* 背景装饰 */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-40 right-20 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-40 left-20 w-80 h-80 bg-gradient-to-tr from-pink-500/5 to-orange-500/5 rounded-full blur-3xl animate-float-delayed" />
        </div>

        {/* 侧边栏 - 仅在大屏幕显示 */}
        {sidebarVisible && (
          <div className="relative z-10 w-80 flex-shrink-0 flex flex-col border-r border-white/10 hidden lg:flex">
            <div className="p-4 sm:p-6 border-b border-white/10">
              <h2 className="text-xs sm:text-sm font-semibold text-secondary uppercase tracking-wider">
                Settings
              </h2>
            </div>
          </div>
        )}

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="inline-flex p-3 sm:p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 mb-4">
            <Sparkles size={28} className="text-primary/60 animate-pulse" />
          </div>
          <p className="text-sm sm:text-base text-secondary">加载中...</p>
        </div>
      </div>
    )
  }

  const connectionUrl = `ws://${connectionInfo.ip}:${connectionInfo.port}`

  return (
    <div className="h-screen flex bg-background/50 relative">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 sm:top-40 right-10 sm:right-20 w-48 sm:w-64 h-48 sm:h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 sm:bottom-40 left-10 sm:left-20 w-64 sm:w-80 h-64 sm:h-80 bg-gradient-to-tr from-pink-500/5 to-orange-500/5 rounded-full blur-3xl animate-float-delayed" />
      </div>

      {/* 左侧边栏 - 仅在大屏幕显示 */}
      {sidebarVisible && (
        <div className="relative z-10 w-64 lg:w-80 flex-shrink-0 flex flex-col border-r border-white/10 hidden lg:flex">
          <div className="p-4 sm:p-6 border-b border-white/10">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <Sparkles size={16} className="text-primary sm:size-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-primary">Settings</h2>
                <p className="text-xs text-secondary">Connection & Security</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="h-14 sm:h-16 px-3 sm:px-4 lg:px-6 border-b border-white/10 flex items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl glass-button"
          >
            <ArrowLeft size={16} className="sm:size-[18px]" />
            <span className="text-xs sm:text-sm font-medium">Back</span>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
            {/* 标题区域 */}
            <div className="text-center mb-6 sm:mb-8 lg:mb-12">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-2 sm:mb-3">
                <span className="gradient-text">Link Your Phone</span>
              </h1>
              <p className="text-secondary text-sm sm:text-base lg:text-lg">
                Enter the following information on your phone to connect to desktop
              </p>
            </div>

            {/* 连接信息卡片 - Bento Grid 风格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* 连接状态卡片 */}
              <Card className="p-4 sm:p-5 md:p-6 group hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-primary truncate">Server Status</h3>
                    <p className="text-xs sm:text-sm text-secondary truncate">WebSocket started</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs sm:text-sm text-secondary">Running on port {connectionInfo.port}</span>
                </div>
              </Card>

              {/* 安全状态卡片 */}
              <Card className="p-4 sm:p-5 md:p-6 group hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-semibold text-primary truncate">Security</h3>
                    <p className="text-xs sm:text-sm text-secondary truncate">
                      {settings.linkPassword ? 'Password protection enabled' : 'No password set'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs sm:text-sm">
                    {settings.linkPassword ? 'Protected' : 'Open Network'}
                  </span>
                </div>
              </Card>
            </div>

            {/* 连接地址卡片 */}
            <Card className="p-4 sm:p-6 md:p-8 relative overflow-hidden group">
              {/* 背景装饰 */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-primary">Connection Address</h3>
                      <p className="text-xs sm:text-sm text-secondary">Enter this address on your phone</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={connectionUrl}
                    readOnly
                    className="flex-1 px-3 sm:px-4 py-2.5 sm:py-4 glass-card border-0 text-sm sm:text-base font-mono text-primary"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2.5 sm:p-4 rounded-xl glass-button group/btn"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check size={18} className="text-green-500 sm:size-5" />
                    ) : (
                      <Copy size={18} className="group-hover/btn:scale-110 transition-transform sm:size-5" />
                    )}
                  </button>
                </div>

                {copied && (
                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-green-600 font-medium animate-pulse">
                    ✓ 已复制到剪贴板
                  </div>
                )}
              </div>
            </Card>

            {/* 二维码卡片 */}
            <Card className="p-4 sm:p-6 md:p-8 relative overflow-hidden group">
              {/* 背景装饰 */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-primary">Scan QR Code to Connect</h3>
                      <p className="text-xs sm:text-sm text-secondary">Scan QR code with your phone to connect automatically</p>
                    </div>
                  </div>
                  <button
                    onClick={generateQRCode}
                    disabled={qrLoading}
                    className="p-2 rounded-xl glass-button group/btn disabled:opacity-50"
                    title="刷新二维码"
                  >
                    <RefreshCw size={16} className={qrLoading ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform sm:size-[18px]'} />
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center py-4 sm:py-6">
                  {qrLoading ? (
                    <div className="flex flex-col items-center gap-3 sm:gap-4">
                      <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-white/50 to-white/20 flex items-center justify-center">
                        <RefreshCw size={28} className="animate-spin text-primary/40 sm:size-8" />
                      </div>
                      <p className="text-xs sm:text-sm text-secondary">生成中...</p>
                    </div>
                  ) : qrCodeData ? (
                    <div className="flex flex-col items-center gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 rounded-2xl bg-white shadow-lg">
                        <img src={qrCodeData} alt="连接二维码" className="w-36 h-36 sm:w-48 sm:h-48" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-xs text-secondary/60">
                          Make sure your phone and computer are on the same LAN
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 sm:gap-4">
                      <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-gradient-to-br from-white/50 to-white/20 flex items-center justify-center">
                        <QrCode size={40} className="text-primary/20 sm:size-12" />
                      </div>
                      <p className="text-xs sm:text-sm text-secondary">Click refresh to generate QR code</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* IP 和端口卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <Card className="p-4 sm:p-5 md:p-6 md:col-span-2">
                <label className="text-xs text-secondary uppercase tracking-wider mb-2 sm:mb-3 block font-semibold">
                  IP Address
                </label>
                <input
                  type="text"
                  value={connectionInfo.ip}
                  readOnly
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 glass-card border-0 text-sm sm:text-base font-mono text-primary"
                />
              </Card>

              <Card className="p-4 sm:p-5 md:p-6">
                <label className="text-xs text-secondary uppercase tracking-wider mb-2 sm:mb-3 block font-semibold">
                  Port
                </label>
                <input
                  type="number"
                  value={settings.port}
                  onChange={(e) => {
                    const port = parseInt(e.target.value) || 3000
                    setSettings({ ...settings, port })
                  }}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 glass-card border-0 text-sm sm:text-base font-mono text-primary focus:ring-2 focus:ring-blue-500/20"
                />
              </Card>
            </div>

            {/* 密码设置卡片 */}
            <Card className="p-4 sm:p-6 md:p-8 relative overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-primary">Security Settings</h3>
                    <p className="text-xs sm:text-sm text-secondary">Set connection password protection</p>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="text-xs text-secondary uppercase tracking-wider mb-1.5 sm:mb-2 block font-semibold">
                      Connection Password (Optional)
                    </label>
                    <div className="flex gap-2 sm:gap-3">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter password..."
                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 glass-card border-0 text-sm sm:text-base text-primary placeholder:text-secondary/60 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-3 sm:px-5 py-2.5 sm:py-3 glass-button text-xs sm:text-sm"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSavePassword}
                    className="w-full py-3 sm:py-4 glass-button-primary font-medium text-sm sm:text-base"
                  >
                    Save Password
                  </button>

                  {settings.linkPassword && (
                    <div className="flex items-center gap-2 text-green-600 text-xs sm:text-sm animate-pulse">
                      <Check size={14} className="sm:size-4" />
                      <span>密码已设置并启用保护</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Bot Settings Card */}
            <BotSettings />

            {/* 移动端对话列表卡片 */}
            <Card className="p-4 sm:p-6 md:p-8 relative overflow-hidden group">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-2xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                      <MessageSquare size={18} className="text-purple-500 sm:size-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-primary">Mobile Conversations</h3>
                      <p className="text-xs sm:text-sm text-secondary">
                        {mobileConversations.length} conversation{mobileConversations.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConversationDrawer(true)}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 glass-button text-xs sm:text-sm font-medium"
                  >
                    View List
                  </button>
                </div>

                {mobileConversations.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 text-secondary text-xs sm:text-sm">
                    No conversations available. Start a conversation on your mobile device.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mobileConversations.slice(0, 3).map(conv => (
                      <div
                        key={conv.id}
                        className={`p-3 rounded-lg border transition-all ${
                          selectedMobileConversationId === conv.id
                            ? 'bg-blue-500/20 border-blue-500/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-1.5 rounded-full ${
                            conv.status === 'ready' ? 'bg-green-500' :
                            conv.status === 'initializing' ? 'bg-yellow-500 animate-pulse' :
                            'bg-gray-500'
                          }`} />
                          <span className="text-xs sm:text-sm font-medium text-primary truncate">
                            {conv.title}
                          </span>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs text-secondary truncate pl-3.5">
                            {conv.lastMessage}
                          </p>
                        )}
                      </div>
                    ))}
                    {mobileConversations.length > 3 && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setShowConversationDrawer(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View {mobileConversations.length - 3} more conversation{mobileConversations.length - 3 !== 1 ? 's' : ''} →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Conversation Drawer */}
            <ConversationDrawer
              isOpen={showConversationDrawer}
              onClose={() => setShowConversationDrawer(false)}
              conversations={mobileConversations}
              selectedConversationId={selectedMobileConversationId}
              onSelectConversation={(id) => setSelectedMobileConversationId(id)}
            />

          </div>
        </div>
      </div>
    </div>
  )
}
