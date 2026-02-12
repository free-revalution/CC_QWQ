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

// Filter mode type
export type FilterMode = 'talk' | 'develop'

// Responsive breakpoints
const BREAKPOINTS = {
  sm: 640,   // Small screen
  md: 768,   // Medium screen
  lg: 1024,  // Large screen
  xl: 1280,  // Extra large screen
}

interface ConversationPageProps {
  projectPath: string | null
  onOpenSettings: () => void
}

// Timeline content component - displays nested timeline in sidebar
function TimelineContent() {
  const [entries, setEntries] = useState<any>([])
  const [filter, setFilter] = useState<{
    status?: string
    tool?: string
  }>({})

  // Load historical logs
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await ipc.getLogs(filter)
        // @ts-ignore - Temporarily bypass type checking, as setEntries type definition needs update
        setEntries(logs)
      } catch (error) {
        console.error('Failed to load timeline entries:', error)
      }
    }
    loadLogs()
  }, [filter])

  // Subscribe to real-time logs
  useEffect(() => {
    const cleanupId = ipc.onLogEntry((log) => {
      setEntries(prev => [...prev, { ...log }].slice(-100)) // Keep last 100 entries
    })
    return () => ipc.removeListener(cleanupId)
  }, [])

  // Get status icon style
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
      {/* Filter */}
      <select
        value={filter.status || ''}
        onChange={(e) => setFilter({ ...filter, status: e.target.value as string | undefined })}
        className="w-full px-2 py-1.5 text-xs glass-card border-0 focus:outline-none focus:ring-1 focus:ring-blue-500/20 mb-2"
      >
        <option value="">All Status</option>
        <option value="success">Success</option>
        <option value="error">Failed</option>
        <option value="pending">Pending</option>
      </select>

      {/* Timeline list */}
      {entries.length === 0 ? (
        <div className="text-xs text-secondary/60 text-center py-4">No operation records</div>
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
  // Project path - for WebSocket server
  projectPath,
  // Open settings dialog callback
  onOpenSettings,
}: ConversationPageProps) {
  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[]>([])
  // Current selected conversation ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  // Input box value
  const [inputValue, setInputValue] = useState('')
  // Search query
  const [searchQuery, setSearchQuery] = useState('')
  // Attached files
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; path: string; content: string }>>([])
  // Context menu state
  const [showMenu, setShowMenu] = useState(false)
  // Context menu position
  const [showContext, setShowContext] = useState(false)
  // Loading state
  const [isLoading, setIsLoading] = useState(false)
  // Error state
  const [error, setError] = useState<string | null>(null)
  // Message counter - for generating unique message IDs
  const [messageCounter, setMessageCounter] = useState(0)
  // IME input method state - to prevent sending message when pressing Enter while composing Chinese
  const [isComposing, setIsComposing] = useState(false)
  // Input box reference - for focusing and scrolling
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Context menu reference - for positioning
  const menuRef = useRef<HTMLDivElement>(null)
  // Message container reference - for virtual scroll height calculation
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Trust folder dialog state
  const [trustRequest, setTrustRequest] = useState<{ conversationId: string; projectPath: string; message: string } | null>(null)
  // Permission dialog state
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
  // Approval dialog state (Controlled AI Operations)
  const [approvalRequest, setApprovalRequest] = useState<{ requestId: string; tool: string; params: Record<string, unknown>; riskLevel: 'low' | 'medium' | 'high'; reason?: string } | null>(null)
  // Approval preferences dialog state
  const [showApprovalPreferences, setShowApprovalPreferences] = useState(false)

  // Model settings dialog state
  const [showModelSettings, setShowModelSettings] = useState(false)

  // Rename dialog state
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

  // Context menu state
  const [contextMenuData, setContextMenuData] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    conversationId: ''
  })

  // Responsive state
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true) // Mobile: completely hide sidebar
  const [sidebarMode, setSidebarMode] = useState<'conversations' | 'timeline'>('conversations') // Sidebar mode

  // Git status panel
  const [gitPanelVisible, setGitPanelVisible] = useState(false)

  // File search panel
  const [searchPanelVisible, setSearchPanelVisible] = useState(false)

  // Operation log panel
  const [operationLogPanelVisible, setOperationLogPanelVisible] = useState(false)

  // Filter mode: Talk (show reply text only) or Develop (show operation process)
  const [filterMode, setFilterMode] = useState<FilterMode>('develop')
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  // ==================== Happy Architecture Improvement - Activity Status ====================
  // Session activity status mapping
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

  // Initialize: load conversations from localStorage, local storage
  useEffect(() => {
    if (projectPath) {
      // Set current project path to main process (for WebSocket server)
      ipc.setProjectPath(projectPath).catch(console.error)

      const loaded = loadConversations()
      const projectConversations = loaded
        .filter(c => c.projectId === projectPath)
        .map(conv => ({
          ...conv,
          // Deduplicate messages: deduplicate by ID, keep first occurrence
          messages: conv.messages.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          ),
        }))

      // Find max messageCounter value to avoid new message ID conflicts
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
        // No conversations, create a new one
        const newConv = createConversation(projectPath)
        setConversations([newConv])
        setCurrentConversationId(newConv.id)
        saveConversations([newConv])
        saveCurrentConversationId(newConv.id)
      } else {
        setConversations(projectConversations)
        // Restore last opened conversation
        const savedId = getCurrentConversationId()
        const validId = projectConversations.find(c => c.id === savedId)?.id || projectConversations[0].id
        setCurrentConversationId(validId)
        saveCurrentConversationId(validId)
      }
    }
  }, [projectPath])

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations)
    }
  }, [conversations])

  // Sync complete chat history to mobile when switching conversation or updating message
  useEffect(() => {
    if (currentConversation) {
      // Update complete chat history
      console.log('=== Update Chat History Effect ===')
      console.log('Current conversation ID:', currentConversationId)
      console.log('Messages count:', currentConversation.messages.length)
      console.log('Message IDs:', currentConversation.messages.map(m => m.id))
      ipc.updateChatHistory(currentConversation.messages).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]) // Trigger when switching conversation

  // Save current conversation ID
  useEffect(() => {
    if (currentConversationId) {
      saveCurrentConversationId(currentConversationId)
    }
  }, [currentConversationId])

  // Listen for trust folder requests from main process
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

  // Listen for permission requests from main process
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

  // Listen for approval requests from main process (Controlled AI Operations)
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

  // Listen for Claude initialization status changes
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

  // ==================== Happy Architecture Improvement - Listen for Activity Status Updates ====================
  // Listen for activity status updates from main process
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

  // Listen for Claude streaming output
  useEffect(() => {
    const cleanupId = ipc.onClaudeStream((data) => {
      if (!data) {
        console.warn('Empty stream data received')
        return
      }
      
      console.log('Stream update:', data.type, data.content?.slice(0, 100))

      // Handle done event
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

      // Find corresponding assistantId based on backend messageId
      let assistantId = messageIdMapRef.current.get(data.messageId)

      // If no mapping found but there's a current active message, mapping may not be established yet
      if (!assistantId && currentClaudeMessageIdRef.current) {
        console.log('No mapping found, using current active message:', currentClaudeMessageIdRef.current)
        assistantId = currentClaudeMessageIdRef.current
      }

      if (!assistantId) {
        console.log('No assistantId found for messageId:', data.messageId)
        return
      }

      // Only process current active message
      if (currentClaudeMessageIdRef.current !== assistantId) {
        console.log('Skipping non-active message:', assistantId, 'current:', currentClaudeMessageIdRef.current)
        return
      }

      setConversations((prev) => {
        return prev.map((conv) => {
          // Route to correct conversation (using conversationId from backend)
          if (conv.id !== data.conversationId) return conv

          const targetMessage = conv.messages.find(m => m.id === assistantId)

          if (!targetMessage) {
            // Message doesn't exist, create new message (directly use current content)
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

          // Message exists, append new content
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

  // Click outside to close menu (excluding context menu area)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is within context menu area
      const target = event.target as Node
      const contextMenu = document.getElementById('context-menu')
      if (contextMenu && contextMenu.contains(target)) {
        return // Click inside menu, don't close
      }

      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowMenu(false)
        setShowContext(false)
      }
      // Close context menu
      setContextMenuData(prev => ({ ...prev, visible: false }))
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Listen for window size changes, handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      setWindowSize({ width: newWidth, height: newHeight })

      // Auto handle sidebar show/hide
      if (newWidth < BREAKPOINTS.md) {
        // Small screen: completely hide sidebar (show via drawer)
        setSidebarVisible(false)
      } else if (newWidth < BREAKPOINTS.lg) {
        // Medium screen: collapse sidebar
        setSidebarCollapsed(true)
        setSidebarVisible(true)
      } else {
        // Large screen: show full sidebar
        setSidebarCollapsed(false)
        setSidebarVisible(true)
      }
    }

    // Initialize
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Toggle sidebar display (mobile drawer style)
  const toggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev)
  }, [])

  // Toggle sidebar collapse (desktop)
  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && attachedFiles.length === 0) || !currentConversation || !projectPath) return

    // Check if Claude is fully initialized (only green status can send messages)
    if (currentConversation.claudeStatus !== 'ready') {
      console.log('Claude not ready yet, status:', currentConversation.claudeStatus)
      setError(currentConversation.claudeStatus === 'initializing'
        ? 'Claude Code is initializing, please wait...'
        : 'Claude Code not started, please start session first')
      return
    }

    console.log('=== Send Message Start ===')
    console.log('Current messageCounter:', messageCounter)
    const userId = `user-${messageCounter}`
    const assistantId = `assistant-${messageCounter}`
    console.log('Generated IDs:', userId, assistantId)

    // Build message content (including attachments)
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

    // Add user message
    setConversations((prev) => {
      const result = prev.map((conv) =>
        conv.id === currentConversationId
          ? {
              ...conv,
              // Check if message with same ID already exists, skip if exists
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

    // Sync user message to mobile
    ipc.addChatMessage(userMessage).catch(console.error)

    setMessageCounter(messageCounter + 1)
    setInputValue('')
    setAttachedFiles([]) // Clear attachment list
    setError(null)
    setIsLoading(true)

    // Set current active message ID first (before sending message)
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
        // Save updated conversation list
        saveConversations(updated)
        return updated
      })
    }
    // Close rename dialog
    setRenameDialog({ visible: false, conversationId: null, currentTitle: '' })
    setNewTitle('')
  }

  const handleCancelRename = () => {
    setRenameDialog({ visible: false, conversationId: null, currentTitle: '' })
    setNewTitle('')
  }

  // Handle permission response
  const handlePermissionResponse = useCallback(async (conversationId: string, choice: string) => {
    console.log('Permission response:', { conversationId, choice })

    if (!permissionRequest) return

    // Send authorization result back to Claude (via IPC, pass conversationId)
    await ipc.respondPermission(conversationId, choice)
    console.log('Permission response sent to Claude:', choice)

    // Close dialog
    setPermissionRequest(null)
  }, [permissionRequest])

  // Handle trust folder response
  const handleTrustResponse = async (trust: boolean) => {
    console.log('Trust response:', trust)

    if (!trustRequest) return

    // Send trust result back to Claude (via IPC, pass conversationId)
    await ipc.respondTrust(trustRequest.conversationId, trust)
    console.log('Trust response sent to Claude:', trust)

    // Close dialog
    setTrustRequest(null)
  }

  // Handle approval response (Controlled AI Operations)
  const handleApprovalResponse = async (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => {
    console.log('Approval response:', { requestId, choice, remember })

    // Send approval result back to ApprovalEngine (via IPC)
    ipc.sendApprovalResponse({ requestId, choice, remember })
    console.log('Approval response sent to ApprovalEngine:', { requestId, choice, remember })

    // Close dialog
    setApprovalRequest(null)
  }

  // Handle input change, detect # and /
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Detect last character
    const lastChar = value.slice(-1)

    if (lastChar === '#') {
      // Show file reference menu
      showMenuAtPosition('file')
    } else if (lastChar === '/') {
      // Show command menu
      showMenuAtPosition('command')
    } else {
      // Other cases, close menu
      setFileMenuVisible(false)
      setCommandMenuVisible(false)
    }
  }

  // Handle Tab key completion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (fileMenuVisible || commandMenuVisible) {
        e.preventDefault()
        // Tab key handled by menu
      }
    }
  }

  // Show menu at specified position
  const showMenuAtPosition = (menuType: 'file' | 'command') => {
    if (!inputContainerRef.current) return

    const rect = inputContainerRef.current.getBoundingClientRect()
    // Calculate menu height (1.5x input box height)
    const menuHeight = rect.height * 1.5
    // Menu position: top of chat content area (above input box, leave menu height space)
    const menuTop = rect.top - menuHeight - 16 // 16px spacing

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

  // Update menu position (call when window moves or size changes)
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

  // Listen for window changes, update menu position
  useEffect(() => {
    if (fileMenuVisible || commandMenuVisible) {
      // Use requestAnimationFrame to continuously update position
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

  // Handle file reference selection
  const handleFileSelect = (filePath: string) => {
    // Insert file path into input box, replace # symbol
    const newValue = inputValue.slice(0, -1) + `@${filePath} `
    setInputValue(newValue)
    inputRef.current?.focus()
  }

  // Handle command selection
  const handleCommandSelect = (commandId: string) => {
    // Special command handling
    if (commandId === '/model') {
      setShowModelSettings(true)
      setInputValue(inputValue.slice(0, -1)) // Remove / symbol
      return
    }

    // /help - Show help information
    if (commandId === '/help') {
      handleShowHelp()
      setInputValue('')
      return
    }

    // /clear - Clear current conversation
    if (commandId === '/clear') {
      handleClearConversation()
      setInputValue('')
      return
    }

    // /settings - Open settings page
    if (commandId === '/settings') {
      onOpenSettings()
      setInputValue('')
      return
    }

    // /attach - Attach file to conversation
    if (commandId === '/attach') {
      handleAttachFile()
      setInputValue('')
      return
    }

    // /thinking - Toggle thinking mode
    if (commandId === '/thinking') {
      handleToggleThinking()
      setInputValue('')
      return
    }

    // /usage - Show usage statistics
    if (commandId === '/usage') {
      setShowModelSettings(true)
      setInputValue('')
      return
    }

    // Other commands: insert command into input box
    const newValue = inputValue.slice(0, -1) + `${commandId} `
    setInputValue(newValue)
    inputRef.current?.focus()
  }

  // Show help information
  const handleShowHelp = () => {
    const helpText = `# CC QwQ Help

## Slash Commands

| Command | Description |
|------|------|
| /help | Show this help information |
| /clear | Clear current conversation |
| /settings | Open settings page |
| /model | Switch AI model |
| /attach | Attach file to conversation |
| /thinking | Toggle thinking mode |
| /usage | View usage statistics |

## Shortcuts

- Enter: Send message
- Shift+Enter: New line
- Ctrl/Cmd+K: Insert file reference
- Ctrl/Cmd+/: Show command menu
- ESC: Close dialog

## Features

- Integration with Claude Code CLI
- Support file references and code search
- Mobile WebSocket connection
- Permission management system
- Multi-conversation management
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

  // Clear current conversation
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

  // Attach file to conversation
  const handleAttachFile = async () => {
    try {
      const result = await ipc.openFile()
      if (result) {
        // Send file path as message
        const attachMessage = `@${result}`
        setInputValue(attachMessage)
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to attach file:', error)
    }
  }

  // Toggle thinking mode
  const handleToggleThinking = () => {
    // Thinking mode can be implemented by adding specific tags before message
    // Simply add prompt in input box here
    const thinkingMessage = `<thinking>\nLet me think about this carefully...\n</thinking>\n\n`
    setInputValue(thinkingMessage + inputValue)
    inputRef.current?.focus()
  }

  // Handle file upload - use new IPC method to upload directly to conversation
  const handleFileUpload = async () => {
    if (!currentConversation || !projectPath) {
      setError('Please select or create a conversation first')
      return
    }

    try {
      const result = await ipc.selectFile()
      if (result.success && result.filePath) {
        setIsLoading(true)
        // Use new uploadFile IPC method to upload directly to conversation
        const uploadResult = await ipc.uploadFile(result.filePath, currentConversation.id)

        if (!uploadResult.success) {
          setError(uploadResult.error || 'File upload failed')
        }
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      setError('File upload failed')
      setIsLoading(false)
    }
  }

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const filteredConversations = conversations
    .filter((conv) => conv.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Pinned conversations rank first
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // Same pin status sort by update time
      return b.updatedAt - a.updatedAt
    })

  // Check if small screen
  const isSmallScreen = windowSize.width < BREAKPOINTS.md

  // Virtual scrolling: estimate message height (based on content length)
  const estimateMessageHeight = useCallback((content: string, role: string): number => {
    const baseHeight = role === 'user' ? 100 : 120
    const contentLines = content.split('\n').length
    const additionalHeight = Math.min(contentLines * 20, 300) // Add max 300px
    return baseHeight + additionalHeight
  }, [])

  // Check if using virtual scroll (message count > 50)
  const useVirtualScroll = (currentConversation?.messages.length || 0) > 50

  return (
    <div className="h-full w-full flex bg-background/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-20 left-10 w-48 h-48 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-float sm:top-40 sm:left-20 sm:w-64 sm:h-64" />
        <div className="absolute bottom-20 right-10 w-60 h-60 bg-gradient-to-tr from-pink-500/5 to-orange-500/5 rounded-full blur-3xl animate-float-delayed sm:bottom-40 sm:right-20 sm:w-80 sm:h-80" />
      </div>

      {/* Mobile overlay */}
      {isSmallScreen && sidebarVisible && (
        <div
          className="fixed inset-0 bg-black/50 z-20 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Left sidebar - responsive */}
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
        {/* Sidebar header */}
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
                    <h2 className="font-semibold text-primary text-sm">Timeline</h2>
                    <p className="text-xs text-secondary">Operation History</p>
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

          {/* Collapse button (desktop) */}
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

          {/* Close button (mobile) */}
          {isSmallScreen && (
            <button
              onClick={toggleSidebar}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
            >
              <X size={20} />
            </button>
          )}

          {/* Search box - only show in conversation list mode */}
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
                      if (isSmallScreen) toggleSidebar() // Mobile: close sidebar after selection
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
                      {/* Activity status indicator dot: display thinking/active/initializing status */}
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

        {/* Bottom button area */}
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
                  title="Timeline"
                >
                  <Clock size={16} className="transition-transform duration-300 text-secondary hover:text-primary" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setSidebarMode('conversations')}
                className="p-2 sm:p-2.5 rounded-full glass-button group hover:bg-white/20 transition-all"
                title="Back to Agent List"
              >
                <ArrowLeft size={16} className="transition-transform duration-300 text-secondary hover:text-primary" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Top bar - responsive */}
        <div className="h-14 sm:h-16 px-3 sm:px-6 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Hamburger menu button (small screen) */}
            {isSmallScreen && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
                title="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            {/* Happy Architecture Improvement - Claude status indicator */}
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
            {/* Happy Architecture Improvement - Detailed activity status indicator */}
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

        {/* Conversation message area - responsive */}
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
            // Virtual scrolling: use when message count > 50
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
              {/* @ts-expect-error react-window type definition incompatible with version */}
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
            // Normal rendering: use when message count <= 50 (with animation)
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
