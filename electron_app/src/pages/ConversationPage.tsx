import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Loader2, Settings, Sparkles, Menu, X, ChevronLeft, Pin, GitBranch, Search, ChevronDown, Home, Paperclip, XCircle, FileText, Shield, Clock, ArrowLeft } from 'lucide-react'
import { List } from 'react-window'
import Card from '../components/ui/Card'
import MessageContent from '../components/ui/MessageContent'
import FileReferenceMenu from '../components/ui/FileReferenceMenu'
import CommandMenu from '../components/ui/CommandMenu'
import ModelSettings from '../components/ui/ModelSettings'
import GitStatusPanel from '../components/ui/GitStatusPanel'
import FileSearchPanel from '../components/ui/FileSearchPanel'
import { OperationLogPanel } from '../components/ui/OperationLogPanel'
import ActivityIndicator, { ActivityDot } from '../components/ui/ActivityIndicator'
import { ApprovalDialog } from '../components/ui/ApprovalDialog'
import { PermissionRequestDialog } from '../components/ui/PermissionRequestDialog'
import { ApprovalPreferences } from '../components/ui/ApprovalPreferences'
import { ipc } from '../lib/ipc'
import {
  loadConversations,
  saveConversations,
  deleteConversation as deleteConversationStorage,
  createConversation,
  getCurrentConversationId,
  setCurrentConversationId as saveCurrentConversationId,
} from '../lib/storage'
import type { Message, Conversation } from '../types'

// 过滤模式类型
export type FilterMode = 'talk' | 'develop'

// 响应式断点
const BREAKPOINTS = {
  sm: 640,   // 小屏幕
  md: 768,   // 中等屏幕
  lg: 1024,  // 大屏幕
  xl: 1280,  // 超大屏幕
}

interface ConversationPageProps {
  projectPath: string | null
  onOpenSettings: () => void
}

// 时间线内容组件 - 用于左侧边栏内嵌显示
function TimelineContent() {
  const [entries, setEntries] = useState<Array<{
    id: string
    timestamp: number
    tool: string
    title: string
    status: string
    details?: unknown
    duration?: number
  }>>([])
  const [filter, setFilter] = useState<{
    status?: string[]
    tool?: string[]
  }>({})

  // 加载历史日志
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await ipc.getLogs(filter)
        setEntries(logs)
      } catch (error) {
        console.error('Failed to load timeline entries:', error)
      }
    }
    loadLogs()
  }, [filter])

  // 订阅实时日志
  useEffect(() => {
    const cleanupId = ipc.onLogEntry((log) => {
      setEntries(prev => [...prev, log].slice(-100)) // 保留最近100条
    })
    return () => ipc.removeListener(cleanupId)
  }, [])

  // 获取状态图标样式
  const getStatusStyle = (status: string) => {
    const styleMap: Record<string, string> = {
      pending: 'text-yellow-400',
      approved: 'text-blue-400',
      denied: 'text-red-400',
      success: 'text-green-400',
      error: 'text-red-400',
      completed: 'text-green-400',
      awaiting_approval: 'text-orange-400',
      running: 'text-blue-400 animate-pulse'
    }
    return styleMap[status] || 'text-gray-400'
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
      {/* 过滤器 */}
      <select
        value={filter.status?.[0] || ''}
        onChange={(e) => setFilter({ ...filter, status: e.target.value ? [e.target.value] : undefined })}
        className="w-full px-2 py-1.5 text-xs glass-card border-0 focus:outline-none focus:ring-1 focus:ring-blue-500/20 mb-2"
      >
        <option value="">全部状态</option>
        <option value="success">成功</option>
        <option value="error">失败</option>
        <option value="pending">等待中</option>
      </select>

      {/* 时间线列表 */}
      {entries.length === 0 ? (
        <div className="text-xs text-secondary/60 text-center py-4">暂无操作记录</div>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className={`p-2 rounded-lg border-l-2 transition-all hover:bg-white/5 ${
              entry.status === 'success' ? 'border-l-green-400' :
              entry.status === 'error' ? 'border-l-red-400' :
              entry.status === 'pending' ? 'border-l-yellow-400' :
              'border-l-gray-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${getStatusStyle(entry.status)}`} />
              <span className="text-xs font-medium text-primary truncate flex-1">
                {entry.tool || 'System'}
              </span>
              <span className="text-[10px] text-secondary/60">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-[11px] text-secondary/80 mt-1 truncate pl-3.5">
              {entry.title}
            </div>
            {entry.duration && (
              <div className="text-[10px] text-blue-400 mt-0.5 pl-3.5">
                {entry.duration}ms
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

export default function ConversationPage({
  // 项目路径 - 用于 WebSocket 服务器
  projectPath,
  // 打开设置弹窗回调
  onOpenSettings,
}: ConversationPageProps) {
  // 对话列表状态
  const [conversations, setConversations] = useState<Conversation[]>([])
  // 当前选中对话 ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  // 输入框值
  const [inputValue, setInputValue] = useState('')
  // 搜索查询
  const [searchQuery, setSearchQuery] = useState('')
  // 附加的文件
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; path: string; content: string }>>([])
  // 上下文菜单状态
  const [showMenu, setShowMenu] = useState(false)
  // 上下文菜单位置
  const [showContext, setShowContext] = useState(false)
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  // 错误状态
  const [error, setError] = useState<string | null>(null)
  // 消息计数器 - 用于生成唯一消息 ID 
  const [messageCounter, setMessageCounter] = useState(0)
  // IME 输入法状态 - 用于防止在输入中文时按回车发送消息
  const [isComposing, setIsComposing] = useState(false)
  // 输入框引用 - 用于聚焦和滚动
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // 上下文菜单引用 - 用于定位
  const menuRef = useRef<HTMLDivElement>(null)
  // 消息容器引用 - 用于虚拟滚动计算高度
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // 信任文件夹弹窗状态
  const [trustRequest, setTrustRequest] = useState<{ conversationId: string; projectPath: string; message: string } | null>(null)
  // 权限弹窗状态
  const [permissionRequest, setPermissionRequest] = useState<{
    conversationId: string
    projectPath: string
    toolName: string
    details: string
    promptType?: 'edit' | 'write' | 'generic' | 'tool-permission'
    options?: string[]
    question?: string
    filterMode: 'develop' | 'talk'
  } | null>(null)
  // 审批弹窗状态（Controlled AI Operations）
  const [approvalRequest, setApprovalRequest] = useState<{ requestId: string; tool: string; params: Record<string, unknown>; riskLevel: 'low' | 'medium' | 'high'; reason?: string } | null>(null)
  // 审批偏好设置弹窗状态
  const [showApprovalPreferences, setShowApprovalPreferences] = useState(false)

  // 模型设置弹窗状态
  const [showModelSettings, setShowModelSettings] = useState(false)

  // 重命名弹窗状态
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean
    conversationId: string | null
    currentTitle: string
  }>({ visible: false, conversationId: null, currentTitle: '' })
  const [newTitle, setNewTitle] = useState('')

  // 菜单状态
  const [fileMenuVisible, setFileMenuVisible] = useState(false)
  const [commandMenuVisible, setCommandMenuVisible] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const inputContainerRef = useRef<HTMLDivElement>(null)

  // 上下文菜单状态
  const [contextMenuData, setContextMenuData] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    conversationId: ''
  })

  // 响应式状态
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true) // 移动端完全隐藏侧边栏
  const [sidebarMode, setSidebarMode] = useState<'conversations' | 'timeline'>('conversations') // 侧边栏模式

  // Git 状态面板
  const [gitPanelVisible, setGitPanelVisible] = useState(false)

  // 文件搜索面板
  const [searchPanelVisible, setSearchPanelVisible] = useState(false)

  // 操作日志面板
  const [operationLogPanelVisible, setOperationLogPanelVisible] = useState(false)

  // 过滤模式：Talk（只显示回复文本）或 Develop（显示操作过程）
  const [filterMode, setFilterMode] = useState<FilterMode>('develop')
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  // ==================== Happy 架构改进 - 活动状态 ====================
  // 会话活动状态映射
  const [sessionActivity, setSessionActivity] = useState<Map<string, {
    active: boolean
    activeAt: number
    thinking: boolean
    thinkingAt: number
  }>>(new Map())

  // 当前正在处理的 Claude 消息 ID (assistantId) - 使用 ref 以避免异步状态更新问题
  const currentClaudeMessageIdRef = useRef<string | null>(null)
  // 消息 ID 映射 (backend messageId -> frontend assistantId)
  const messageIdMapRef = useRef<Map<string, string>>(new Map())

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  )

  // 初始化：从 localStorage 加载对话，本地存储
  useEffect(() => {
    if (projectPath) {
      // 设置当前项目路径到主进程（用于 WebSocket 服务器）
      ipc.setProjectPath(projectPath).catch(console.error)

      const loaded = loadConversations()
      const projectConversations = loaded
        .filter(c => c.projectId === projectPath)
        .map(conv => ({
          ...conv,
          // 去重消息：按 ID 去重，保留首次出现的
          messages: conv.messages.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          ),
        }))

      // 找出最大的 messageCounter 值，避免新消息 ID 冲突
      let maxCounter = 0
      projectConversations.forEach(conv => {
        conv.messages.forEach(msg => {
          const match = msg.id.match(/^(user|assistant)-(\d+)$/)
          if (match) {
            const counter = parseInt(match[2], 10)
            if (counter > maxCounter) {
              maxCounter = counter
            }
          }
        })
      })
      setMessageCounter(maxCounter + 1)

      if (projectConversations.length === 0) {
        // 没有对话，创建一个新对话
        const newConv = createConversation(projectPath)
        setConversations([newConv])
        setCurrentConversationId(newConv.id)
        saveConversations([newConv])
        saveCurrentConversationId(newConv.id)
      } else {
        setConversations(projectConversations)
        // 恢复上次打开的对话
        const savedId = getCurrentConversationId()
        const validId = projectConversations.find(c => c.id === savedId)?.id || projectConversations[0].id
        setCurrentConversationId(validId)
        saveCurrentConversationId(validId)
      }
    }
  }, [projectPath])

  // 保存对话到 localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations)
    }
  }, [conversations])

  // 切换对话或消息更新时，同步完整的聊天历史到移动端
  useEffect(() => {
    if (currentConversation) {
      // 更新完整的聊天历史
      console.log('=== Update Chat History Effect ===')
      console.log('Current conversation ID:', currentConversationId)
      console.log('Messages count:', currentConversation.messages.length)
      console.log('Message IDs:', currentConversation.messages.map(m => m.id))
      ipc.updateChatHistory(currentConversation.messages).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]) // 当切换对话时触发

  // 保存当前对话 ID
  useEffect(() => {
    if (currentConversationId) {
      saveCurrentConversationId(currentConversationId)
    }
  }, [currentConversationId])

  // 监听来自主进程的信任文件夹请求
  useEffect(() => {
    const cleanupId = ipc.onTrustRequest((data) => {
      console.log('Received trust request from main process:', data)
      setTrustRequest(data)
    })
    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 监听来自主进程的权限请求
  useEffect(() => {
    const cleanupId = ipc.onPermissionRequest((data) => {
      console.log('Received permission request from main process:', data)
      setPermissionRequest(data)
    })
    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 监听来自主进程的审批请求（Controlled AI Operations）
  useEffect(() => {
    const cleanupId = ipc.onApprovalRequest((data) => {
      console.log('Received approval request from main process:', data)
      setApprovalRequest(data)
    })
    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 监听 Claude 初始化状态变化
  useEffect(() => {
    const cleanupId = ipc.onClaudeStatusChange((data) => {
      console.log('Received Claude status change:', data)
      setConversations((prev) => {
        return prev.map(conv => {
          if (conv.id === data.conversationId) {
            return { ...conv, claudeStatus: data.status }
          }
          return conv
        })
      })
    })
    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // ==================== Happy 架构改进 - 监听活动状态更新 ====================
  // 监听来自主进程的活动状态更新
  useEffect(() => {
    const cleanupId = ipc.onActivityUpdate((update) => {
      console.log('Received activity update:', update)
      setSessionActivity(prev => {
        const newMap = new Map(prev)
        newMap.set(update.sessionId, {
          active: update.active,
          activeAt: update.activeAt,
          thinking: update.thinking ?? false,
          thinkingAt: update.thinkingAt ?? 0
        })
        return newMap
      })
    })

    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 监听 Claude 流式输出
  useEffect(() => {
    const cleanupId = ipc.onClaudeStream((data) => {
      if (!data) {
        console.warn('Empty stream data received')
        return
      }
      
      console.log('Stream update:', data.type, data.content?.slice(0, 100))

      // 处理 done 事件
      if (data.type === 'done') {
        const assistantId = messageIdMapRef.current.get(data.messageId)
        if (assistantId && currentClaudeMessageIdRef.current === assistantId) {
          setIsLoading(false)
          currentClaudeMessageIdRef.current = null
          messageIdMapRef.current.delete(data.messageId)
          console.log('Stream completed for:', assistantId, 'conversationId:', data.conversationId)
        }
        return
      }

      // 根据后端 messageId 找到对应的 assistantId
      let assistantId = messageIdMapRef.current.get(data.messageId)

      // 如果没有找到映射，但有当前活动的消息，可能是映射还没建立
      if (!assistantId && currentClaudeMessageIdRef.current) {
        console.log('No mapping found, using current active message:', currentClaudeMessageIdRef.current)
        assistantId = currentClaudeMessageIdRef.current
      }

      if (!assistantId) {
        console.log('No assistantId found for messageId:', data.messageId)
        return
      }

      // 只处理当前活动的消息
      if (currentClaudeMessageIdRef.current !== assistantId) {
        console.log('Skipping non-active message:', assistantId, 'current:', currentClaudeMessageIdRef.current)
        return
      }

      setConversations((prev) => {
        return prev.map((conv) => {
          // 路由到正确的对话（使用后端传来的 conversationId）
          if (conv.id !== data.conversationId) return conv

          const targetMessage = conv.messages.find(m => m.id === assistantId)

          if (!targetMessage) {
            // 消息不存在，创建新消息（直接使用当前内容）
            console.log('Target message not found:', assistantId, 'creating with content length:', data.content?.length || 0)
            const assistantMessage: Message = {
              id: assistantId,
              role: 'assistant',
              content: data.content || '',
              timestamp: Date.now(),
            }
            return {
              ...conv,
              messages: [...conv.messages, assistantMessage],
              updatedAt: Date.now(),
            }
          }

          // 消息已存在，追加新内容
          const updatedMessage = {
            ...targetMessage,
            content: targetMessage.content + (data.content || ''),
          }

          return {
            ...conv,
            messages: conv.messages.map(m =>
              m.id === assistantId ? updatedMessage : m
            ),
            updatedAt: Date.now(),
          }
        })
      })
    })
    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 点击外部关闭菜单（不包括上下文菜单区域）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 检查点击是否在上下文菜单区域内
      const target = event.target as Node
      const contextMenu = document.getElementById('context-menu')
      if (contextMenu && contextMenu.contains(target)) {
        return // 点击在菜单内，不关闭
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowMenu(false)
        setShowContext(false)
      }
      // 关闭上下文菜单
      setContextMenuData(prev => ({ ...prev, visible: false }))
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 监听窗口大小变化，处理响应式布局
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      setWindowSize({ width: newWidth, height: newHeight })

      // 自动处理侧边栏显示/隐藏
      if (newWidth < BREAKPOINTS.md) {
        // 小屏幕：完全隐藏侧边栏（通过抽屉式显示）
        setSidebarVisible(false)
      } else if (newWidth < BREAKPOINTS.lg) {
        // 中等屏幕：折叠侧边栏
        setSidebarCollapsed(true)
        setSidebarVisible(true)
      } else {
        // 大屏幕：显示完整侧边栏
        setSidebarCollapsed(false)
        setSidebarVisible(true)
      }
    }

    // 初始化
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 切换侧边栏显示（移动端抽屉式）
  const toggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev)
  }, [])

  // 切换侧边栏折叠（桌面端）
  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || !currentConversation || !projectPath) return

    // 检查 Claude 是否已初始化完成（只有绿色状态才能发送消息）
    if (currentConversation.claudeStatus !== 'ready') {
      console.log('Claude not ready yet, status:', currentConversation.claudeStatus)
      setError(currentConversation.claudeStatus === 'initializing'
        ? 'Claude Code 正在初始化中，请稍等...'
        : 'Claude Code 未启动，请先启动会话')
      return
    }

    console.log('=== Send Message Start ===')
    console.log('Current messageCounter:', messageCounter)
    const userId = `user-${messageCounter}`
    const assistantId = `assistant-${messageCounter}`
    console.log('Generated IDs:', userId, assistantId)

    // 构建消息内容（包含附件）
    let messageContent = inputValue
    if (attachedFiles.length > 0) {
      const fileContents = attachedFiles.map(file =>
        `\n\n[File: ${file.path}]\n${file.content}`
      ).join('')
      messageContent = inputValue + fileContents
    }

    const userMessage: Message = {
      id: userId,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    }

    // 添加用户消息
    setConversations((prev) => {
      const result = prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              // 检查是否已存在相同 ID 的消息，如果存在则跳过
              messages: conv.messages.some(m => m.id === userMessage.id)
                ? conv.messages
                : [...conv.messages, userMessage],
              updatedAt: Date.now(),
              title: conv.title === 'New Agent' ? inputValue.slice(0, 30) : conv.title,
            }
          : conv
      )
      return result
    })

    // 同步用户消息到移动端
    ipc.addChatMessage(userMessage).catch(console.error)

    setMessageCounter(messageCounter + 1)
    setInputValue('')
    setAttachedFiles([]) // 清空附件列表
    setError(null)
    setIsLoading(true)

    // 先设置当前活动的消息 ID（在发送消息之前）
    currentClaudeMessageIdRef.current = assistantId

    try {
      // 发送消息，获取消息 ID（传递 conversationId 和 filterMode 以实现会话隔离和过滤）
      const response = await ipc.claudeSend(currentConversation.id, projectPath, messageContent, filterMode)
      const messageId = response?.messageId

      if (messageId) {
        // 存储 messageId -> assistantId 映射
        messageIdMapRef.current.set(messageId, assistantId)
        console.log('Message ID mapping established:', messageId, '->', assistantId)
      } else {
        console.warn('No messageId received from claudeSend')
      }

      // 检查是否在模拟模式下
      if (!window.electronAPI?.claudeSend) {
        // 模拟流式响应
        console.log('Running in mock mode, simulating streaming response...')
        const mockResponse = `I understand you're asking about this project. Based on the context, this appears to be a desktop application built with Electron that connects to a mobile app. The application seems to use Claude Code for AI assistance.
        
Some key features I can see:
- Project management with Git integration
- File searching capabilities
- Permission management for tools
- Model settings for AI configuration
- QR code generation for mobile connection

Is there something specific you'd like to know or modify about this project?`
        
        // 模拟流式输出
        let accumulatedContent = ''
        const delay = 50 // 每个字符的延迟时间
        
        for (let i = 0; i < mockResponse.length; i++) {
          accumulatedContent += mockResponse[i]
          
          // 使用 setTimeout 模拟异步流式输出
          setTimeout(() => {
            // 检查消息是否仍然是当前活动消息
            if (currentClaudeMessageIdRef.current === assistantId) {
              setConversations((prev) => {
                const result = prev.map((conv) => {
                  if (conv.id !== currentConversationId) return conv

                  const targetMessage = conv.messages.find(m => m.id === assistantId)
                  if (!targetMessage) {
                    // 如果消息不存在，创建一个新的
                    const assistantMessage: Message = {
                      id: assistantId,
                      role: 'assistant',
                      content: accumulatedContent,
                      timestamp: Date.now(),
                    }
                    return {
                      ...conv,
                      messages: [...conv.messages, assistantMessage],
                      updatedAt: Date.now(),
                    }
                  }

                  // 追加内容
                  return {
                    ...conv,
                    messages: conv.messages.map(m =>
                      m.id === assistantId
                        ? { ...m, content: accumulatedContent }
                        : m
                    ),
                    updatedAt: Date.now(),
                  }
                })
                return result
              })
            }
          }, i * delay)
        }
        
        // 模拟完成事件
        setTimeout(() => {
          if (currentClaudeMessageIdRef.current === assistantId) {
            setIsLoading(false)
            currentClaudeMessageIdRef.current = null
            messageIdMapRef.current.delete(messageId)
            console.log('Mock stream completed for:', assistantId)
          }
        }, mockResponse.length * delay + 100)
      }
    } catch (err) {
      console.error('Claude error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message to Claude')
      setIsLoading(false)
    }
  }

  const handleNewConversation = async () => {
    if (!projectPath) return

    const newConv = createConversation(projectPath)
    setConversations((prev) => [newConv, ...prev])
    setCurrentConversationId(newConv.id)

    // 立即初始化 Claude 会话
    try {
      console.log('Initializing Claude for conversation:', newConv.id, 'Project:', projectPath)
      await ipc.initializeClaude(newConv.id, projectPath)
    } catch (error) {
      console.error('Failed to initialize Claude session:', error)
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    // 清理对话对应的 PTY 会话
    try {
      await ipc.cleanupConversation(conversationId)
      console.log('Cleanup conversation session:', conversationId)
    } catch (error) {
      console.error('Failed to cleanup conversation session:', error)
    }

    deleteConversationStorage(conversationId)

    setConversations((prev) => {
      const filtered = prev.filter(c => c.id !== conversationId)

      // 保存更新后的对话列表
      saveConversations(filtered)

      // 如果删除的是当前对话，切换到其他对话
      if (conversationId === currentConversationId) {
        const nextConv = filtered[0]
        if (nextConv) {
          setCurrentConversationId(nextConv.id)
        } else {
          // 没有对话了，创建新对话
          const newConv = createConversation(projectPath!)
          saveConversations([newConv])
          setCurrentConversationId(newConv.id)
          return [newConv]
        }
      }

      return filtered.length > 0 ? filtered : [createConversation(projectPath!)]
    })

    // 关闭上下文菜单
    setContextMenuData(prev => ({ ...prev, visible: false }))
  }

  const handlePinConversation = (conversationId: string) => {
    setConversations((prev) => {
      const conversation = prev.find(c => c.id === conversationId)
      if (!conversation) return prev

      // 切换置顶状态
      const updatedConv = { ...conversation, isPinned: !conversation.isPinned }

      // Remove the conversation from its current position
      const filtered = prev.filter(c => c.id !== conversationId)

      // 如果置顶，添加到开头；否则添加到原位置附近（置顶组之后）
      let updated: Conversation[]
      if (updatedConv.isPinned) {
        updated = [updatedConv, ...filtered]
      } else {
        // 取消置顶，放到非置顶对话的开头
        const pinned = filtered.filter(c => c.isPinned)
        const unpinned = filtered.filter(c => !c.isPinned)
        updated = [...pinned, updatedConv, ...unpinned]
      }

      // 保存更新后的对话列表
      saveConversations(updated)

      return updated
    })

    // 关闭上下文菜单
    setContextMenuData(prev => ({ ...prev, visible: false }))
  }

  const handleRenameConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      setRenameDialog({
        visible: true,
        conversationId,
        currentTitle: conversation.title
      })
      setNewTitle(conversation.title)
    }
    // 关闭上下文菜单
    setContextMenuData(prev => ({ ...prev, visible: false }))
  }

  const handleSaveRename = () => {
    if (renameDialog.conversationId && newTitle.trim()) {
      setConversations((prev) => {
        const updated = prev.map(c =>
          c.id === renameDialog.conversationId
            ? { ...c, title: newTitle.trim() }
            : c
        )
        // 保存更新后的对话列表
        saveConversations(updated)
        return updated
      })
    }
    // 关闭重命名弹窗
    setRenameDialog({ visible: false, conversationId: null, currentTitle: '' })
    setNewTitle('')
  }

  const handleCancelRename = () => {
    setRenameDialog({ visible: false, conversationId: null, currentTitle: '' })
    setNewTitle('')
  }

  // 处理权限响应
  const handlePermissionResponse = useCallback(async (conversationId: string, choice: string) => {
    console.log('Permission response:', { conversationId, choice })

    if (!permissionRequest) return

    // 将授权结果发送回给 Claude（通过 IPC，传递 conversationId）
    await ipc.respondPermission(conversationId, choice)
    console.log('Permission response sent to Claude:', choice)

    // 关闭弹窗
    setPermissionRequest(null)
  }, [permissionRequest])

  // 处理信任文件夹响应
  const handleTrustResponse = async (trust: boolean) => {
    console.log('Trust response:', trust)

    if (!trustRequest) return

    // 将信任结果发送回给 Claude（通过 IPC，传递 conversationId）
    await ipc.respondTrust(trustRequest.conversationId, trust)
    console.log('Trust response sent to Claude:', trust)

    // 关闭弹窗
    setTrustRequest(null)
  }

  // 处理审批响应（Controlled AI Operations）
  const handleApprovalResponse = async (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => {
    console.log('Approval response:', { requestId, choice, remember })

    // 将审批结果发送回给 ApprovalEngine（通过 IPC）
    ipc.sendApprovalResponse({ requestId, choice, remember })
    console.log('Approval response sent to ApprovalEngine:', { requestId, choice, remember })

    // 关闭弹窗
    setApprovalRequest(null)
  }

  // 处理输入变化，检测 # 和 /
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputValue(value)

    // 检测最后一个字符
    const lastChar = value.slice(-1)

    if (lastChar === '#') {
      // 显示文件引用菜单
      showMenuAtPosition('file')
    } else if (lastChar === '/') {
      // 显示命令菜单
      showMenuAtPosition('command')
    } else {
      // 其他情况关闭菜单
      setFileMenuVisible(false)
      setCommandMenuVisible(false)
    }
  }

  // 处理 Tab 键补全
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (fileMenuVisible || commandMenuVisible) {
        e.preventDefault()
        // Tab 键由菜单处理
      }
    }
  }

  // 显示菜单在指定位置
  const showMenuAtPosition = (menuType: 'file' | 'command') => {
    if (!inputContainerRef.current) return

    const rect = inputContainerRef.current.getBoundingClientRect()
    // 计算菜单高度（输入框高度的1.5倍）
    const menuHeight = rect.height * 1.5
    // 菜单位置：聊天内容区域顶部（输入框上方，留出菜单高度的空间）
    const menuTop = rect.top - menuHeight - 16 // 16px 间距

    setMenuPosition({
      top: menuTop,
      left: rect.left,
      width: rect.width,
      height: menuHeight,
    })

    if (menuType === 'file') {
      setFileMenuVisible(true)
      setCommandMenuVisible(false)
    } else {
      setFileMenuVisible(false)
      setCommandMenuVisible(true)
    }
  }

  // 更新菜单位置（在窗口移动或大小变化时调用）
  const updateMenuPosition = useCallback(() => {
    if (!inputContainerRef.current) return
    if (!fileMenuVisible && !commandMenuVisible) return

    const rect = inputContainerRef.current.getBoundingClientRect()
    const menuHeight = rect.height * 1.5
    const menuTop = rect.top - menuHeight - 16

    setMenuPosition({
      top: menuTop,
      left: rect.left,
      width: rect.width,
      height: menuHeight,
    })
  }, [fileMenuVisible, commandMenuVisible])

  // 监听窗口变化，更新菜单位置
  useEffect(() => {
    if (fileMenuVisible || commandMenuVisible) {
      // 使用 requestAnimationFrame 持续更新位置
      let animationFrameId: number

      const updatePosition = () => {
        updateMenuPosition()
        animationFrameId = requestAnimationFrame(updatePosition)
      }

      updatePosition()

      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
        }
      }
    }
  }, [fileMenuVisible, commandMenuVisible, updateMenuPosition])

  // 处理文件引用选择
  const handleFileSelect = (filePath: string) => {
    // 将文件路径插入到输入框，替换 # 符号
    const newValue = inputValue.slice(0, -1) + `@${filePath} `
    setInputValue(newValue)
    inputRef.current?.focus()
  }

  // 处理命令选择
  const handleCommandSelect = (commandId: string) => {
    // 特殊命令处理
    if (commandId === '/model') {
      setShowModelSettings(true)
      setInputValue(inputValue.slice(0, -1)) // 移除 / 符号
      return
    }

    // /help - 显示帮助信息
    if (commandId === '/help') {
      handleShowHelp()
      setInputValue('')
      return
    }

    // /clear - 清空当前对话
    if (commandId === '/clear') {
      handleClearConversation()
      setInputValue('')
      return
    }

    // /settings - 打开设置页面
    if (commandId === '/settings') {
      onOpenSettings()
      setInputValue('')
      return
    }

    // /attach - 附加文件到对话
    if (commandId === '/attach') {
      handleAttachFile()
      setInputValue('')
      return
    }

    // /thinking - 切换思考模式
    if (commandId === '/thinking') {
      handleToggleThinking()
      setInputValue('')
      return
    }

    // /usage - 显示使用量统计
    if (commandId === '/usage') {
      setShowModelSettings(true)
      setInputValue('')
      return
    }

    // 其他命令：将命令插入到输入框
    const newValue = inputValue.slice(0, -1) + `${commandId} `
    setInputValue(newValue)
    inputRef.current?.focus()
  }

  // 显示帮助信息
  const handleShowHelp = () => {
    const helpText = `# CC QwQ 帮助

## 斜杠命令

| 命令 | 描述 |
|------|------|
| /help | 显示此帮助信息 |
| /clear | 清空当前对话 |
| /settings | 打开设置页面 |
| /model | 切换 AI 模型 |
| /attach | 附加文件到对话 |
| /thinking | 切换思考模式 |
| /usage | 查看使用量统计 |

## 快捷键

- Enter: 发送消息
- Shift+Enter: 换行
- Ctrl/Cmd+K: 插入文件引用
- Ctrl/Cmd+/: 显示命令菜单
- ESC: 关闭弹窗

## 功能特性

- 与 Claude Code CLI 集成
- 支持文件引用和代码搜索
- 移动端 WebSocket 连接
- 权限管理系统
- 多对话管理
`
    if (currentConversationId) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === currentConversationId) {
          const newMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: helpText,
            timestamp: Date.now(),
          }
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            updatedAt: Date.now(),
          }
        }
        return conv
      }))
    }
  }

  // 清空当前对话
  const handleClearConversation = () => {
    if (currentConversationId) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages: [],
            updatedAt: Date.now(),
          }
        }
        return conv
      }))
    }
  }

  // 附加文件到对话
  const handleAttachFile = async () => {
    try {
      const result = await ipc.openFile()
      if (result) {
        // 将文件路径作为消息发送
        const attachMessage = `@${result}`
        setInputValue(attachMessage)
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to attach file:', error)
    }
  }

  // 切换思考模式
  const handleToggleThinking = () => {
    // 思考模式可以通过在消息前添加特定标记来实现
    // 这里简单地在输入框添加提示
    const thinkingMessage = `<thinking>\n让我仔细思考这个问题...\n</thinking>\n\n`
    setInputValue(thinkingMessage + inputValue)
    inputRef.current?.focus()
  }

  // 处理文件上传 - 使用新的 IPC 方法直接上传到对话
  const handleFileUpload = async () => {
    if (!currentConversation || !projectPath) {
      setError('请先选择或创建一个对话')
      return
    }

    try {
      const result = await ipc.selectFile()
      if (result.success && result.filePath) {
        setIsLoading(true)
        // 使用新的 uploadFile IPC 方法直接上传到对话
        const uploadResult = await ipc.uploadFile(result.filePath, currentConversation.id)

        if (!uploadResult.success) {
          setError(uploadResult.error || '文件上传失败')
        }
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      setError('文件上传失败')
      setIsLoading(false)
    }
  }

  // 移除附件
  const handleRemoveAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const filteredConversations = conversations
    .filter((conv) => conv.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // 置顶的对话排在前面
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // 同样置顶状态按更新时间排序
      return b.updatedAt - a.updatedAt
    })

  // 判断是否为小屏幕
  const isSmallScreen = windowSize.width < BREAKPOINTS.md

  // 虚拟滚动：估算消息高度（基于内容长度）
  const estimateMessageHeight = useCallback((content: string, role: string): number => {
    const baseHeight = role === 'user' ? 100 : 120
    const contentLines = content.split('\n').length
    const additionalHeight = Math.min(contentLines * 20, 300) // 最多增加 300px
    return baseHeight + additionalHeight
  }, [])

  // 判断是否使用虚拟滚动（消息数 > 50）
  const useVirtualScroll = (currentConversation?.messages.length || 0) > 50

  return (
    <div className="h-full w-full flex bg-background/50 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-20 left-10 w-48 h-48 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-float sm:top-40 sm:left-20 sm:w-64 sm:h-64" />
        <div className="absolute bottom-20 right-10 w-60 h-60 bg-gradient-to-tr from-pink-500/5 to-orange-500/5 rounded-full blur-3xl animate-float-delayed sm:bottom-40 sm:right-20 sm:w-80 sm:h-80" />
      </div>

      {/* 移动端遮罩层 */}
      {isSmallScreen && sidebarVisible && (
        <div
          className="fixed inset-0 bg-black/50 z-20 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* 左侧边栏 - 响应式 */}
      <div
        className={`
          relative z-30 flex flex-col border-r border-white/10 transition-all duration-300
          ${isSmallScreen
            ? `fixed top-0 left-0 bottom-0 w-72 bg-background/95 shadow-2xl ${sidebarVisible ? 'translate-x-0' : '-translate-x-full'}`
            : sidebarCollapsed
              ? 'w-16'
              : 'w-80'
          }
        `}
      >
        {/* 侧边栏头部 */}
        <div className={`p-4 border-b border-white/10 ${sidebarCollapsed && !isSmallScreen ? 'flex items-center justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed && !isSmallScreen ? '' : 'mb-2 sm:mb-3'}`}>
            {(!sidebarCollapsed || isSmallScreen) && (
              <div className="p-2 rounded-xl bg-black">
                {sidebarMode === 'timeline' ? (
                  <Clock size={sidebarCollapsed && !isSmallScreen ? 16 : 20} className="text-white" />
                ) : (
                  <Sparkles size={sidebarCollapsed && !isSmallScreen ? 16 : 20} className="text-white" />
                )}
              </div>
            )}
            {(!sidebarCollapsed || isSmallScreen) && (
              <div className={isSmallScreen ? 'block' : 'hidden lg:block'}>
                {sidebarMode === 'timeline' ? (
                  <>
                    <h2 className="font-semibold text-primary text-sm">时间线</h2>
                    <p className="text-xs text-secondary">操作历史</p>
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-primary text-sm">Conversations</h2>
                    <p className="text-xs text-secondary">{conversations.length} conversations</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 折叠按钮（桌面端） */}
          {!isSmallScreen && (
            <button
              onClick={toggleSidebarCollapse}
              className={`absolute top-3 right-2 p-2 sm:p-2.5 transition-all glass-button ${
                sidebarCollapsed
                  ? 'rounded-full bg-white text-black hover:bg-gray-100'
                  : 'rounded-lg hover:bg-white/20 text-secondary hover:text-primary'
              }`}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft size={16} className={`transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* 关闭按钮（移动端） */}
          {isSmallScreen && (
            <button
              onClick={toggleSidebar}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
            >
              <X size={20} />
            </button>
          )}

          {/* 搜索框 - 只在对话列表模式显示 */}
          {(!sidebarCollapsed || isSmallScreen) && sidebarMode === 'conversations' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-9 glass-card border-0 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

            </div>
          )}
        </div>

        {/* 对话列表或时间线内容 */}
        {(!sidebarCollapsed || isSmallScreen) && (
          <>
            {sidebarMode === 'timeline' ? (
              /* 时间线内容 */
              <TimelineContent />
            ) : (
          <div className="flex-1 overflow-y-auto p-1 sm:p-3 space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`relative group rounded-lg transition-all duration-300 ${
                  conv.id === currentConversationId
                    ? 'glass-card shadow-md'
                    : 'hover:bg-white/30'
                }`}
              >
                <div className="relative">
                  <button
                    onClick={() => {
                      setCurrentConversationId(conv.id)
                      if (isSmallScreen) toggleSidebar() // 移动端选择后关闭侧边栏
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      console.log('Right-click on conversation:', conv.id)
                      setContextMenuData({
                        visible: true,
                        position: { x: e.clientX, y: e.clientY },
                        conversationId: conv.id
                      })
                      console.log('Context menu data set:', {
                        visible: true,
                        position: { x: e.clientX, y: e.clientY },
                        conversationId: conv.id
                      })
                    }}
                    className="w-full text-left p-2 sm:p-4 rounded-lg"
                    title={sidebarCollapsed && !isSmallScreen ? conv.title : undefined}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className={`font-medium truncate flex-1 text-sm flex items-center gap-1.5 ${
                        conv.id === currentConversationId
                          ? 'text-transparent bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text'
                          : 'text-primary group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 group-hover:bg-clip-text'
                      } transition-all`}>
                        {conv.isPinned && <Pin size={12} className="text-purple-500 flex-shrink-0" />}
                        {(!sidebarCollapsed || isSmallScreen) && conv.title}
                      </div>
                      {/* 活动状态指示点：显示thinking/active/初始化状态 */}
                      <ActivityDot
                        active={sessionActivity.get(conv.id)?.active ?? false}
                        thinking={sessionActivity.get(conv.id)?.thinking ?? false}
                        className="flex-shrink-0"
                      />
                    </div>
                    {(!sidebarCollapsed || isSmallScreen) && (
                      <div className="text-xs text-secondary/80">
                        {conv.messages.length} {conv.messages.length === 1 ? 'msg' : 'msgs'}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
            )}
          </>
        )}

        {/* 底部按钮区域 */}
        {(!sidebarCollapsed || isSmallScreen) && (
          <div className="p-2 sm:p-4 border-t border-white/10 flex gap-2 sm:gap-3">
            {sidebarMode === 'conversations' ? (
              <>
                <button
                  onClick={() => {
                    handleNewConversation()
                    if (isSmallScreen) toggleSidebar()
                  }}
                  className="p-2 sm:p-2.5 rounded-full glass-button group hover:bg-white/20 transition-all"
                  title="New Agent"
                >
                  <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300 text-secondary hover:text-primary" />
                </button>
                <button
                  onClick={() => {
                    window.location.href = '/'
                  }}
                  className="p-2 sm:p-2.5 rounded-full glass-button group hover:bg-white/20 transition-all"
                  title="Back to Home"
                >
                  <Home size={16} className="transition-transform duration-300 text-secondary hover:text-primary" />
                </button>
                <button
                  onClick={() => setSidebarMode('timeline')}
                  className="p-2 sm:p-2.5 rounded-full glass-button group hover:bg-white/20 transition-all"
                  title="时间线"
                >
                  <Clock size={16} className="transition-transform duration-300 text-secondary hover:text-primary" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarMode('conversations')}
                className="p-2 sm:p-2.5 rounded-full glass-button group hover:bg-white/20 transition-all"
                title="返回Agent列表"
              >
                <ArrowLeft size={16} className="transition-transform duration-300 text-secondary hover:text-primary" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* 顶部栏 - 响应式 */}
        <div className="h-14 sm:h-16 px-3 sm:px-6 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* 汉堡菜单按钮（小屏幕） */}
            {isSmallScreen && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
                title="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            {/* Happy 架构改进 - Claude 状态指示器 */}
            <div
              key={`status-dot-${currentConversationId}`}
              className={`
                w-2 h-2 rounded-full animate-pulse flex-shrink-0
                ${currentConversation?.claudeStatus === 'initializing'
                  ? 'bg-red-500'
                  : currentConversation?.claudeStatus === 'ready'
                    ? 'bg-green-500'
                    : 'bg-gray-500'}
              `}
            />
            {/* Happy 架构改进 - 详细活动状态指示器 */}
            {currentConversationId && (
              <ActivityIndicator
                active={sessionActivity.get(currentConversationId)?.active ?? false}
                thinking={sessionActivity.get(currentConversationId)?.thinking ?? false}
                activeAt={sessionActivity.get(currentConversationId)?.activeAt}
                thinkingAt={sessionActivity.get(currentConversationId)?.thinkingAt}
                className="text-xs"
              />
            )}
            <span className="text-xs sm:text-sm text-secondary/80 font-mono truncate">
              {projectPath}
            </span>
          </div>
          <button
            onClick={() => setGitPanelVisible(true)}
            disabled={!projectPath}
            className="p-2 sm:p-2.5 rounded-xl glass-button hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Git Status"
          >
            <GitBranch size={16} />
          </button>
          <button
            onClick={() => setSearchPanelVisible(true)}
            disabled={!projectPath}
            className="p-2 sm:p-2.5 rounded-xl glass-button hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Search Files"
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setOperationLogPanelVisible(true)}
            disabled={!projectPath}
            className="p-2 sm:p-2.5 rounded-xl glass-button hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Operation Logs"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={() => setShowApprovalPreferences(true)}
            className="p-2 sm:p-2.5 rounded-xl glass-button hover:bg-white/20 transition-all"
            title="Approval Preferences"
          >
            <Shield size={16} />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 sm:p-2.5 rounded-xl glass-button hover:bg-white/20 transition-all"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* 对话消息区域 - 响应式 */}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <Card className="p-3 sm:p-4 bg-red-500/10 border-red-500/20">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/20">
                  <span className="text-red-500 text-xs sm:text-sm font-medium">Error</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-red-700 break-words">{error}</p>
                </div>
              </div>
            </Card>
          )}

          {currentConversation?.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center px-4">
              <div className="text-center max-w-md">
                <h3 className="text-xl sm:text-2xl font-semibold text-secondary mb-2 sm:mb-3">
                  Start a new agent
                </h3>
                <p className="text-sm sm:text-base text-secondary/70">
                  Ask Claude Code anything about your project
                </p>
              </div>
            </div>
          ) : useVirtualScroll ? (
            // 虚拟滚动：消息数 > 50 时使用
            <List
              height={messagesContainerRef.current?.clientHeight || 600}
              itemCount={currentConversation?.messages.length || 0}
              itemSize={(index: number) => {
                const message = currentConversation?.messages[index];
                if (!message) return 120;
                return estimateMessageHeight(message.content, message.role);
              }}
              width="100%"
            >
              {/* @ts-expect-error react-window类型定义与版本不兼容 */}
              {(props: { rowIndex: number; style: React.CSSProperties }) => {
                const { rowIndex, style } = props;
                const message = currentConversation?.messages[rowIndex];
                if (!message) return <></>;

                return (
                  <div style={style} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <Card
                      className={`max-w-[85%] sm:max-w-2xl min-w-[120px] p-3 sm:p-5 break-words whitespace-pre-wrap ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                          : 'glass-card'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-3">
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 text-primary'
                        }`}>
                          {message.role === 'user' ? 'U' : 'C'}
                        </div>
                        <span className="text-xs sm:text-sm text-secondary font-medium">
                          {message.role === 'user' ? 'You' : 'Claude'}
                        </span>
                      </div>
                      <MessageContent content={message.content} />
                    </Card>
                  </div>
                );
              }}
            </List>
          ) : (
            // 普通渲染：消息数 <= 50 时使用（带动画）
            currentConversation?.messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{
                  animation: `fadeInUp 0.4s ease-out ${index * 50}ms both`,
                }}
              >
                <Card
                  className={`max-w-[85%] sm:max-w-2xl min-w-[120px] p-3 sm:p-5 break-words whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20'
                      : 'glass-card'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white'
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-primary'
                    }`}>
                      {msg.role === 'user' ? 'U' : 'C'}
                    </div>
                    <span className="text-xs sm:text-sm text-secondary font-medium">
                      {msg.role === 'user' ? 'You' : 'Claude'}
                    </span>
                  </div>
                  <MessageContent content={msg.content} />
                </Card>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start" style={{ animation: 'fadeInUp 0.4s ease-out both' }}>
              <Card className="max-w-[85%] sm:max-w-2xl min-w-[120px] p-3 sm:p-5 glass-card break-words whitespace-pre-wrap">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-semibold text-primary animate-pulse">
                    C
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-secondary">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Claude is thinking...</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* 底部输入框 - 响应式 */}
        <div className="p-3 sm:p-6 border-t border-white/10">
          <div className="max-w-4xl mx-auto" ref={inputContainerRef}>
            {/* 文件预览区域 */}
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="glass-card px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Paperclip size={14} className="text-secondary flex-shrink-0" />
                    <span className="text-primary truncate max-w-[200px]">{file.name}</span>
                    <button
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-secondary hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove attachment"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="glass-card p-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  handleKeyDown(e)
                  // 只有在非输入法状态下，按 Enter 才发送消息
                  if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                    e.preventDefault()
                    if (!isLoading && (inputValue.trim() || attachedFiles.length > 0)) {
                      handleSendMessage()
                    }
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={isLoading ? "Claude is thinking..." : "Ask Claude Code anything..."}
                rows={2}
                disabled={isLoading}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-transparent border-0 text-sm sm:text-base text-primary placeholder:text-secondary/60 resize-none focus:outline-none min-h-[60px] sm:min-h-[80px]"
              />

              {/* 功能按钮栏 */}
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* 文件附件按钮 */}
                  <button
                    onClick={handleFileUpload}
                    disabled={isLoading}
                    className="p-2 rounded-lg glass-button hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Attach file"
                  >
                    <Paperclip size={16} className="text-secondary hover:text-primary" />
                  </button>

                  {/* 模式选择器 */}
                  <div className="relative">
                    <button
                      onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg glass-button hover:bg-white/20 transition-all text-xs sm:text-sm"
                    >
                      <span className="font-medium capitalize">{filterMode}</span>
                      <ChevronDown size={14} className={`transition-transform ${modeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* 下拉菜单 */}
                    {modeDropdownOpen && (
                      <div className="absolute bottom-full left-0 mb-2 glass-card rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50">
                        <button
                          onClick={() => {
                            setFilterMode('talk')
                            setModeDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2 transition-colors ${
                              filterMode === 'talk' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-primary'
                            }`}
                        >
                          <span className="font-medium">Talk</span>
                        </button>
                        <button
                          onClick={() => {
                            setFilterMode('develop')
                            setModeDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center gap-2 transition-colors ${
                              filterMode === 'develop' ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-primary'
                            }`}
                        >
                          <span className="font-medium">Develop</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={(!inputValue.trim() && attachedFiles.length === 0) || isLoading}
                  className="p-2 sm:p-3 rounded-xl bg-black text-white hover:shadow-lg hover:shadow-black/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                  title="Send"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <img src="/箭头上_arrow-up.svg" alt="Send" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 底部提示 - 隐藏在小屏幕 */}
            <div className="hidden sm:flex items-center justify-between mt-3 text-sm text-secondary/60">
              <div className="flex gap-4">
                <button
                  onClick={() => showMenuAtPosition('file')}
                  className="hover:text-primary transition-colors"
                >
                  # Reference code
                </button>
                <button
                  onClick={() => showMenuAtPosition('command')}
                  className="hover:text-primary transition-colors"
                >
                  / Commands
                </button>
              </div>
              <button
                onClick={onOpenSettings}
                className="hover:text-primary transition-colors"
              >
                Link phone
              </button>
            </div>
          </div>
        </div>

        {/* 菜单弹窗 */}
        {showMenu && (
          <div
            ref={menuRef}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 glass-card p-3 min-w-72 z-50"
            style={{
              animation: 'fadeInUp 0.3s ease-out both',
            }}
          >
            <div className="text-xs text-secondary px-3 py-2 uppercase tracking-wider font-semibold">
              Commands
            </div>
            <div className="space-y-1">
              <button className="w-full px-4 py-3 text-left text-sm text-primary hover:bg-white/20 rounded-xl transition-all flex items-center gap-3">
                <span className="text-lg">💡</span>
                <span>/help - Show help</span>
              </button>
              <button className="w-full px-4 py-3 text-left text-sm text-primary hover:bg-white/20 rounded-xl transition-all flex items-center gap-3">
                <span className="text-lg">🧹</span>
                <span>/clear - Clear conversation</span>
              </button>
              <button className="w-full px-4 py-3 text-left text-sm text-primary hover:bg-white/20 rounded-xl transition-all flex items-center gap-3">
                <span className="text-lg">⚙️</span>
                <span>/settings - Open settings</span>
              </button>
            </div>
          </div>
        )}

        {/* 上下文引用弹窗 */}
        {showContext && (
          <div
            ref={menuRef}
            className="fixed bottom-32 right-8 glass-card p-5 min-w-96 z-50"
            style={{
              animation: 'fadeInUp 0.3s ease-out both',
            }}
          >
            <div className="text-xs text-secondary px-3 py-2 uppercase tracking-wider font-semibold mb-3">
              Reference Code
            </div>
            <p className="text-sm text-secondary px-3 mb-4">
              Select files to reference in your conversation...
            </p>
            <div className="space-y-2">
              <button className="w-full px-4 py-3 text-left text-sm text-primary hover:bg-white/20 rounded-xl transition-all flex items-center gap-3">
                <span className="text-lg">📁</span>
                <span>Browse files...</span>
              </button>
              <button className="w-full px-4 py-3 text-left text-sm text-primary hover:bg-white/20 rounded-xl transition-all flex items-center gap-3">
                <span className="text-lg">🔍</span>
                <span>Search symbols...</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 文件引用菜单 */}
      <FileReferenceMenu
        isVisible={fileMenuVisible}
        position={menuPosition}
        onSelect={handleFileSelect}
        onClose={() => setFileMenuVisible(false)}
        projectPath={projectPath}
      />

      {/* 命令菜单 */}
      <CommandMenu
        isVisible={commandMenuVisible}
        position={menuPosition}
        onSelect={handleCommandSelect}
        onClose={() => setCommandMenuVisible(false)}
      />

      {/* 信任文件夹请求弹窗 */}
      {trustRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-fadeIn">
            <h3 className="text-lg font-semibold text-primary mb-4">Trust this folder?</h3>
            <p className="text-sm text-secondary mb-6">
              Claude Code may read, write, or execute files contained in this directory.
              This can pose security risks, so only use files and bash commands from trusted sources.
            </p>
            <p className="text-xs text-secondary/70 mb-4 font-mono">{trustRequest.projectPath}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleTrustResponse(false)}
                className="flex-1 px-4 py-2.5 rounded-xl glass-button text-sm font-medium text-secondary hover:text-primary transition-colors"
              >
                Don't Trust
              </button>
              <button
                onClick={() => handleTrustResponse(true)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
              >
                Trust
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 权限请求弹窗 */}
      <PermissionRequestDialog
        isOpen={!!permissionRequest}
        request={permissionRequest}
        onRespond={handlePermissionResponse}
        onClose={() => setPermissionRequest(null)}
      />

      {/* 模型设置弹窗 */}
      {showModelSettings && (
        <ModelSettings onClose={() => setShowModelSettings(false)} />
      )}

      {/* 审批请求弹窗（Controlled AI Operations） */}
      <ApprovalDialog
        isOpen={!!approvalRequest}
        request={approvalRequest}
        onRespond={handleApprovalResponse}
        onClose={() => setApprovalRequest(null)}
      />

      {/* 审批偏好设置弹窗 */}
      {showApprovalPreferences && (
        <ApprovalPreferences onClose={() => setShowApprovalPreferences(false)} />
      )}

      {/* Git 状态面板 */}
      <GitStatusPanel
        projectPath={projectPath}
        visible={gitPanelVisible}
        onClose={() => setGitPanelVisible(false)}
      />

      {/* 文件搜索面板 */}
      <FileSearchPanel
        projectPath={projectPath}
        visible={searchPanelVisible}
        onClose={() => setSearchPanelVisible(false)}
        onInsertReference={(filePath, line) => {
          const reference = line ? `@${filePath}:${line}` : `@${filePath}`
          setInputValue(prev => prev + reference)
          inputRef.current?.focus()
        }}
      />

      {/* 操作日志面板 */}
      {operationLogPanelVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setOperationLogPanelVisible(false)}
        >
          <div
            className="glass-card rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <OperationLogPanel />
          </div>
        </div>
      )}

      {/* 重命名弹窗 */}
      {renameDialog.visible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleCancelRename}
        >
          <div
            className="glass-card rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-primary mb-4">Rename Conversation</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRename()
                } else if (e.key === 'Escape') {
                  handleCancelRename()
                }
              }}
              className="w-full px-4 py-3 glass-card border-0 text-primary placeholder:text-secondary/60 focus:ring-2 focus:ring-blue-500/20 mb-4"
              placeholder="Enter new title..."
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleCancelRename}
                className="flex-1 px-4 py-2.5 rounded-xl glass-button text-sm font-medium text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}


      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* 上下文菜单 */}
      {contextMenuData.visible && (
        <div
          onClick={() => setContextMenuData(prev => ({ ...prev, visible: false }))}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
          }}
        >
          {/* 菜单容器 - 停止事件冒泡，防止触发外层的关闭 */}
          <div
            id="context-menu"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            style={{
              position: 'fixed',
              left: contextMenuData.position.x,
              top: contextMenuData.position.y,
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              width: '200px',
              animation: 'fadeInUp 0.2s ease-out both'
            }}
          >
            <button
              onClick={() => {
                handleDeleteConversation(contextMenuData.conversationId)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 16px',
                textAlign: 'left' as const,
                fontSize: '14px',
                color: '#f87171',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Delete Conversation
            </button>
            <button
              onClick={() => {
                handlePinConversation(contextMenuData.conversationId)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 16px',
                textAlign: 'left' as const,
                fontSize: '14px',
                color: '#e5e7eb',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {conversations.find(c => c.id === contextMenuData.conversationId)?.isPinned ? 'Unpin Conversation' : 'Pin Conversation'}
            </button>
            <button
              onClick={() => {
                handleRenameConversation(contextMenuData.conversationId)
              }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 16px',
              textAlign: 'left' as const,
              fontSize: '14px',
              color: '#e5e7eb',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Rename Conversation
          </button>
        </div>
        </div>
      )}
    </div>
  )
}
