import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  WSMessage,
  ChatMessage,
  ConnectionConfig,
  ConnectionStatus,
  ClaudeStatus,
  PermissionRequestMessage,
  PermissionChoice,
  Conversation,
  SelectConversationMessage,
} from '../types'

const RECONNECT_INTERVAL = 3000 // 3秒重连间隔
const MAX_RECONNECT_ATTEMPTS = 10

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const configRef = useRef<ConnectionConfig | null>(null) // 存储配置用于重连
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const messageQueueRef = useRef<string[]>([])
  const messageIdsRef = useRef<Set<string>>(new Set()) // 跟踪已见过的消息 ID

  // 权限请求状态
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestMessage['data'] | null>(null)
  const permissionResponseCallbackRef = useRef<((choice: PermissionChoice) => void) | null>(null)

  // 连接 WebSocket（内部实现，不需要 config 参数）
  const connectInternal = useCallback(() => {
    const config = configRef.current
    if (!config) {
      console.error('No config available for connection')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setStatus('connecting')
    setError(null)

    try {
      const ws = new WebSocket(config.url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        reconnectAttemptsRef.current = 0

        // 重置消息 ID 跟踪（新连接可能需要重新获取所有消息）
        messageIdsRef.current.clear()

        // 如果有密码，先进行认证
        if (config.password) {
          setStatus('authenticating')
          ws.send(JSON.stringify({
            type: 'auth',
            password: config.password,
          }))
        } else {
          // 即使没有密码，也要等待服务器的 auth 成功响应
          setStatus('authenticating')
          // 不立即发送消息，等待 auth 成功响应后再发送
        }
      }

      ws.onmessage = (event) => {
        console.log('Raw WebSocket message:', event.data)
        try {
          const message: WSMessage = JSON.parse(event.data)
          console.log('Parsed message type:', message.type, 'full message:', message)

          switch (message.type) {
            case 'auth':
              // 认证响应
              console.log('Auth response received, success:', 'success' in message ? message.success : 'N/A')
              if ('success' in message && message.success) {
                setStatus('connected')
                console.log('Status set to connected')
                // 发送排队的消息
                if (messageQueueRef.current.length > 0) {
                  console.log('Sending queued messages:', messageQueueRef.current.length)
                  messageQueueRef.current.forEach(msg => {
                    if (ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'message', data: { content: msg } }))
                    }
                  })
                  messageQueueRef.current = []
                }
              } else {
                setStatus('error')
                setError('认证失败，请检查密码')
                console.log('Auth failed')
              }
              break

            case 'history':
              // 接收聊天历史 - 替换所有消息，并重置 ID 跟踪
              console.log('History message received, data length:', Array.isArray(message.data) ? message.data.length : 'N/A')
              if (Array.isArray(message.data)) {
                // 过滤重复消息
                const uniqueMessages = message.data.filter((msg: ChatMessage) => {
                  const isNew = !messageIdsRef.current.has(msg.id)
                  if (isNew) {
                    messageIdsRef.current.add(msg.id)
                  }
                  return isNew
                })
                setMessages(uniqueMessages)
                console.log(`Received history: ${uniqueMessages.length} messages`)
              } else {
                console.error('History data is not an array:', message.data)
              }
              break

            case 'message':
              // 接收广播的单条消息 - 检查是否已存在再添加
              console.log('Broadcast message received')
              if (message.data && 'id' in message.data && 'role' in message.data) {
                const newMsg = message.data as ChatMessage
                // 使用 ref 跟踪，避免状态问题
                if (!messageIdsRef.current.has(newMsg.id)) {
                  messageIdsRef.current.add(newMsg.id)
                  setMessages((prev) => [...prev, newMsg])
                  console.log(`Added new message: ${newMsg.id}`)
                } else {
                  console.log(`Skipped duplicate message: ${newMsg.id}`)
                }
              }
              break

            case 'response':
              // Claude 响应 - 从桌面端广播的完整消息
              if (message.data && 'id' in message.data) {
                const responseMsg = message.data as ChatMessage
                if (!messageIdsRef.current.has(responseMsg.id)) {
                  messageIdsRef.current.add(responseMsg.id)
                  setMessages((prev) => [...prev, responseMsg])
                  console.log(`Added response: ${responseMsg.id}`)
                } else {
                  console.log(`Skipped duplicate response: ${responseMsg.id}`)
                }
                setClaudeStatus('idle')
              }
              break

            case 'status':
              // Claude 状态更新
              console.log('Status message received:', message.data.status)
              setClaudeStatus(message.data.status)
              break

            case 'permission_request':
              // 权限请求 - 显示权限弹窗
              console.log('Permission request received:', message.data)
              if (message.data && 'id' in message.data) {
                setPermissionRequest(message.data as PermissionRequestMessage['data'])
              }
              break

            case 'conversation_list':
              // Conversation 列表 - 桌面端发送的会话列表
              console.log('Conversation list received:', message.data.conversations)
              if (message.data && 'conversations' in message.data && Array.isArray(message.data.conversations)) {
                setConversations(message.data.conversations)
              }
              break

            case 'conversation_update':
              // Conversation 更新 - 桌面端广播的会话更新
              console.log('Conversation update received:', message.data.conversations)
              if (message.data && 'conversations' in message.data && Array.isArray(message.data.conversations)) {
                setConversations(message.data.conversations)
              }
              break

            default:
              // 未知消息类型 - 记录但不中断
              const unknownType = (message as any).type
              console.log('Unknown message type received:', unknownType, 'full message:', message)
              break
          }
        } catch (err) {
          console.error('Failed to parse message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error event:', event)
        console.error('WebSocket readyState:', ws.readyState)
        console.error('WebSocket url:', ws.url)
        setStatus('error')
        setError('连接错误')
      }

      ws.onclose = (event) => {
        console.log('WebSocket closed')
        console.log('Close code:', event.code, 'reason:', event.reason, 'wasClean:', event.wasClean)
        console.log('ReadyState at close:', ws.readyState)
        setStatus('disconnected')

        // 自动重连
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && configRef.current) {
          reconnectAttemptsRef.current++
          console.log(`Reconnecting... attempt ${reconnectAttemptsRef.current}`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connectInternal()
          }, RECONNECT_INTERVAL)
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('连接失败，请手动重连')
        }
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : '连接失败')
    }
  }, [])

  // 对外暴露的连接函数
  const connect = useCallback((config: ConnectionConfig) => {
    // 关闭现有连接
    if (wsRef.current) {
      wsRef.current.close()
    }

    // 存储配置
    configRef.current = config

    // 开始连接
    connectInternal()
  }, [connectInternal])

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
  }, [])

  // 发送消息
  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // 连接未建立，加入队列
      messageQueueRef.current.push(content)
      setError('未连接，消息已加入队列')
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setClaudeStatus('thinking')

    wsRef.current.send(JSON.stringify({
      type: 'message',
      data: { content },
    }))
  }, [])

  // 处理权限响应
  const handlePermissionResponse = useCallback((choice: PermissionChoice) => {
    if (!permissionRequest || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    console.log('Sending permission response:', choice)

    // 发送权限响应消息
    wsRef.current.send(JSON.stringify({
      type: 'permission_response',
      data: {
        requestId: permissionRequest.id,
        choice,
        timestamp: Date.now(),
        source: 'mobile',
      },
    }))

    // 关闭权限弹窗
    setPermissionRequest(null)
  }, [permissionRequest])

  // 关闭权限弹窗（拒绝）
  const closePermissionRequest = useCallback(() => {
    handlePermissionResponse('no')
  }, [handlePermissionResponse])

  // 选择 Conversation
  const selectConversation = useCallback((conversationId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('未连接，无法选择对话')
      return
    }

    console.log('Selecting conversation:', conversationId)

    const message: SelectConversationMessage = {
      type: 'select_conversation',
      data: { conversationId },
    }

    wsRef.current.send(JSON.stringify(message))
    setSelectedConversationId(conversationId)

    // 清空当前消息，等待新对话的历史记录
    setMessages([])
    messageIdsRef.current.clear()
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    status,
    claudeStatus,
    messages,
    conversations,
    selectedConversationId,
    error,
    connect,
    disconnect,
    sendMessage,
    selectConversation,
    permissionRequest,
    handlePermissionResponse,
    closePermissionRequest,
  }
}
