/**
 * WebSocket 消息类型
 */
export type MessageType = 'auth' | 'message' | 'response' | 'status' | 'history' | 'permission_request' | 'permission_response' | 'conversation_list' | 'conversation_update' | 'select_conversation'

/**
 * 聊天状态
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticating' | 'error'

/**
 * Claude 状态
 */
export type ClaudeStatus = 'idle' | 'thinking' | 'error'

/**
 * 认证请求消息（客户端发送）
 */
export interface AuthRequestMessage {
  type: 'auth'
  password: string
}

/**
 * 认证响应消息（服务器发送）
 */
export interface AuthResponseMessage {
  type: 'auth'
  success: boolean
}

/**
 * 发送消息
 */
export interface SendMessage {
  type: 'message'
  data: {
    content: string
  }
}

/**
 * 聊天消息广播（包含完整的 ChatMessage）
 */
export interface BroadcastMessage {
  type: 'message'
  data: {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  }
}

/**
 * 响应消息（与 ChatMessage 格式一致）
 */
export interface ResponseMessage {
  type: 'response'
  data: {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  }
}

/**
 * 状态消息
 */
export interface StatusMessage {
  type: 'status'
  data: {
    status: ClaudeStatus
  }
}

/**
 * 历史记录消息
 */
export interface HistoryMessage {
  type: 'history'
  data: ChatMessage[]
}

/**
 * Claude Code 工具类型
 */
export type ClaudeToolType =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'WebFetch'
  | 'Glob'
  | 'Grep'
  | 'NotebookEdit'
  | 'Task'
  | 'AskUserQuestion'
  | 'Skill'

/**
 * 权限请求类型
 */
export type PermissionToolType =
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'execute_command'
  | 'network_request'
  | 'file_search'
  | 'content_search'
  | 'user_input'

/**
 * 权限请求状态
 */
export type PermissionStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

/**
 * 权限响应选项
 */
export type PermissionChoice =
  | 'yes'
  | 'yesAlways'
  | 'no'
  | 'noAlways'
  | 'exit'

/**
 * 权限请求消息（服务器发送给移动端）
 */
export interface PermissionRequestMessage {
  type: 'permission_request'
  data: {
    id: string
    type: PermissionToolType
    toolType: ClaudeToolType
    title: string
    description: string
    resourcePath?: string
    command?: string
    details?: string[]
    createdAt: number
    status: PermissionStatus
    source: 'desktop' | 'mobile'
  }
}

/**
 * 权限响应消息（移动端发送给服务器）
 */
export interface PermissionResponseMessage {
  type: 'permission_response'
  data: {
    requestId: string
    choice: PermissionChoice
    timestamp: number
    source: 'desktop' | 'mobile'
  }
}

/**
 * Conversation 状态（对应桌面端的 Claude 初始化状态）
 */
export type ConversationStatus = 'not_started' | 'initializing' | 'ready'

/**
 * Conversation 数据结构（从桌面端同步的会话信息）
 */
export interface Conversation {
  /** 唯一 ID */
  id: string
  /** 对话标题 */
  title: string
  /** Claude 状态 */
  status: ConversationStatus
  /** 最后一条消息预览 */
  lastMessage?: string
  /** 最后更新时间戳 */
  updatedAt: number
  /** 是否被当前移动端用户选中 */
  isSelected?: boolean
}

/**
 * Conversation 列表消息（桌面端 → 移动端）
 */
export interface ConversationListMessage {
  type: 'conversation_list'
  data: {
    conversations: Conversation[]
  }
}

/**
 * Conversation 更新消息（桌面端 → 移动端）
 */
export interface ConversationUpdateMessage {
  type: 'conversation_update'
  data: {
    conversations: Conversation[]
  }
}

/**
 * 选择 Conversation 消息（移动端 → 桌面端）
 */
export interface SelectConversationMessage {
  type: 'select_conversation'
  data: {
    conversationId: string
  }
}

/**
 * WebSocket 消息联合类型
 */
export type WSMessage =
  | AuthRequestMessage
  | AuthResponseMessage
  | SendMessage
  | BroadcastMessage
  | ResponseMessage
  | StatusMessage
  | HistoryMessage
  | PermissionRequestMessage
  | PermissionResponseMessage
  | ConversationListMessage
  | ConversationUpdateMessage
  | SelectConversationMessage

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
  url: string  // ws://xxx:3000
  password?: string
}

/**
 * WebSocket Hook 状态
 */
export interface WebSocketState {
  status: ConnectionStatus
  claudeStatus: ClaudeStatus
  messages: ChatMessage[]
  conversations: Conversation[]
  selectedConversationId: string | null
  error: string | null
}
