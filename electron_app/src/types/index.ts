/**
 * 项目信息
 */
export interface Project {
  /** 项目路径 */
  path: string
  /** 项目名称 */
  name: string
  /** 最后打开时间戳 */
  lastOpened: number
}

/**
 * 应用设置
 */
export interface Settings {
  /** 连接密码 */
  linkPassword: string
  /** 服务端口 */
  port: number
}

/**
 * 页面类型
 */
export type PageType = 'open' | 'conversation' | 'settings'

/**
 * 过滤模式
 */
export type FilterMode = 'talk' | 'develop'

/**
 * 应用状态
 */
export interface AppState {
  /** 当前页面 */
  currentPage: PageType
  /** 选中的项目路径 */
  projectPath: string | null
  /** 最近项目列表 */
  recentProjects: Project[]
  /** 应用设置 */
  settings: Settings
}

/**
 * 对话消息
 */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/**
 * 对话
 */
export interface Conversation {
  /** 唯一 ID */
  id: string
  /** 关联的项目路径 */
  projectId: string
  /** 对话标题 */
  title: string
  /** 消息列表 */
  messages: Message[]
  /** 创建时间 */
  createdAt: number
  /** 最后更新时间 */
  updatedAt: number
  /** 是否置顶 */
  isPinned?: boolean
  /** 标签 */
  tags?: string[]
  /** Claude 初始化状态：'initializing' 初始化中（红色） | 'ready' 就绪（绿色） | 'not_started' 未启动（无灯） */
  claudeStatus?: 'not_started' | 'initializing' | 'ready'
}

/**
 * 移动端显示的 Conversation（简化版）
 */
export interface MobileConversation {
  /** 唯一 ID */
  id: string
  /** 对话标题 */
  title: string
  /** Claude 状态 */
  status: 'not_started' | 'initializing' | 'ready'
  /** 最后一条消息预览 */
  lastMessage?: string
  /** 最后更新时间戳 */
  updatedAt: number
  /** 是否被当前移动端用户选中 */
  isSelected?: boolean
}

/**
 * Electron IPC 接口
 */
export interface ElectronAPI {
  /** 打开文件夹选择器 */
  openFolder: () => Promise<string | null>
  /** 打开文件选择器 */
  openFile: () => Promise<string | null>
  /** 选择文件（用于文件附件功能） */
  selectFile: () => Promise<{ success: boolean; filePath?: string }>
  /** 上传文件到对话 */
  uploadFile: (filePath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>
  /** 发送消息给 Claude Code，返回消息 ID */
  claudeSend: (
    conversationId: string,
    projectPath: string,
    message: string,
    filterMode?: FilterMode
  ) => Promise<{ messageId: string }>
  /** 设置连接密码 */
  setLinkPassword: (password: string) => Promise<{ success: boolean; port: number }>
  /** 获取连接信息 */
  getConnectionInfo: () => Promise<{ ip: string; port: number; hasPassword: boolean }>
  /** 设置当前项目路径 */
  setProjectPath: (projectPath: string) => Promise<{ success: boolean }>
  /** 更新聊天历史 */
  updateChatHistory: (messages: Message[]) => Promise<{ success: boolean }>
  /** 添加单条消息 */
  addChatMessage: (message: Message) => Promise<{ success: boolean }>
  /** 请求权限 */
  requestPermission: (request: PermissionRequest) => Promise<PermissionResponse>
  /** 获取权限规则列表 */
  getPermissionRules: () => Promise<PermissionRule[]>
  /** 添加权限规则 */
  addPermissionRule: (rule: PermissionRule) => Promise<{ success: boolean }>
  /** 清除权限规则 */
  clearPermissionRules: () => Promise<{ success: boolean }>
  /** 读取目录 */
  readDirectory: (dirPath: string) => Promise<{ success: boolean; tree?: import('./global').FileNode[]; error?: string }>
  /** 读取 Claude 配置 */
  readClaudeConfig: () => Promise<{ success: boolean; config?: import('./global').ClaudeConfig; error?: string }>
  /** 获取 API 用量 */
  getAPIUsage: () => Promise<{ success: boolean; usage?: import('./global').UsageInfo; error?: string }>
  /** 获取已安装的 Skills */
  getSkills: () => Promise<{ success: boolean; skills?: Array<{ name: string; path: string; description?: string }>; error?: string }>
  /** 获取 MCP 服务器配置 */
  getMCPServers: () => Promise<{ success: boolean; servers?: Array<{ name: string; command: string; args?: string[] }>; error?: string }>
  /** 切换模型 */
  switchModel: (modelId: string) => Promise<{ success: boolean; modelId?: string; error?: string }>
  /** 获取 Git 状态 */
  getGitStatus: (projectPath: string) => Promise<{
    success: boolean
    git?: {
      currentBranch: string
      branches: string[]
      status: string
      commits: Array<{ hash: string; message: string; author: string; date: string }>
    }
    error?: string
  }>
  /** 搜索文件内容 */
  searchFiles: (projectPath: string, query: string) => Promise<{ success: boolean; results?: Array<{ file: string; line: number; content: string }>; error?: string }>
  /** 读取项目的对话记录 */
  readProjectConversations: (projectPath: string) => Promise<{ success: boolean; conversations?: Conversation[]; error?: string }>
  /** 保存项目的对话记录 */
  saveProjectConversations: (projectPath: string, conversations: Conversation[]) => Promise<{ success: boolean; error?: string }>
  /** 删除项目的对话记录 */
  deleteProjectConversation: (projectPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>
  /** 响应信任文件夹请求 */
  respondTrust: (conversationId: string, trust: boolean) => Promise<{ success: boolean; error?: string }>
  /** 响应权限请求 */
  respondPermission: (conversationId: string, choice: string) => Promise<{ success: boolean; error?: string }>
  /** 清理对话会话 */
  cleanupConversation: (conversationId: string) => Promise<{ success: boolean }>
  /** 初始化 Claude 会话（新建对话时主动创建 PTY） */
  initializeClaude: (conversationId: string, projectPath: string) => Promise<{ success: boolean }>
  /** 监听信任文件夹请求 */
  onTrustRequest: (callback: (data: { conversationId: string; projectPath: string; message: string }) => void) => string
  /** 监听权限请求 */
  onPermissionRequest: (callback: (data: { conversationId: string; projectPath: string; toolName: string; details: string }) => void) => string
  /** 监听 Claude 初始化状态变化 */
  onClaudeStatusChange: (callback: (data: { conversationId: string; status: 'not_started' | 'initializing' | 'ready' }) => void) => string
  /** Happy 架构改进 - 监听活动状态更新 */
  onActivityUpdate: (callback: (data: import('./message').ActivityUpdate) => void) => string
  /** 获取 conversation 列表（用于移动端同步） */
  getConversationList: () => Promise<{ success: boolean; conversations?: MobileConversation[]; error?: string }>
  /** 平台信息 */
  platform: string
  /** 监听 Claude 流式输出 */
  onClaudeStream: (callback: (data: { conversationId: string; messageId: string; type: string; content: string; toolName?: string; toolInput?: string; timestamp: number }) => void) => string
  /** 移除监听器 */
  removeListener: (cleanupId: string) => void

  /** ==================== 操作日志 ==================== */

  /** 订阅实时日志 */
  onLogEntry: (callback: (log: import('./operation').LogEntry) => void) => string

  /** 获取日志 */
  getLogs: (filter?: import('./operation').LogFilter) => Promise<import('./operation').LogEntry[]>

  /** 清空日志 */
  clearLogs: () => Promise<{ success: boolean }>

  /** 导出日志 */
  exportLogs: (format?: 'json' | 'text') => Promise<string>

  /** ==================== 审批引擎 ==================== */

  /** 响应审批请求 */
  sendApprovalResponse: (response: {
    requestId: string
    choice: 'approve' | 'deny'
    remember: 'once' | 'always'
  }) => void

  /** 获取审批偏好设置 */
  getApprovalPreferences: () => Promise<import('./operation').UserPreferences>

  /** 更新审批偏好设置 */
  updateApprovalPreferences: (preferences: Partial<import('./operation').UserPreferences>) => Promise<{ success: boolean }>

  /** 清除记住的选择 */
  clearRememberedChoices: () => Promise<{ success: boolean }>
}

/**
 * Claude Code 工具类型（对应 Claude Code 的工具）
 */
export type ClaudeToolType =
  | 'Read'        // 读取文件
  | 'Write'       // 写入文件
  | 'Edit'        // 编辑文件
  | 'Bash'        // 执行命令
  | 'WebFetch'    // 网络请求
  | 'Glob'        // 文件搜索
  | 'Grep'        // 内容搜索
  | 'NotebookEdit' // Jupyter notebook 编辑
  | 'Task'        // 启动子任务
  | 'AskUserQuestion' // 向用户提问
  | 'Skill'       // 调用技能

/**
 * 权限请求类型
 */
export type PermissionToolType =
  | 'file_read'       // Read 工具
  | 'file_write'      // Write 工具
  | 'file_edit'       // Edit 工具
  | 'execute_command' // Bash 工具
  | 'network_request' // WebFetch 工具
  | 'file_search'     // Glob 工具
  | 'content_search'  // Grep 工具
  | 'user_input'      // AskUserQuestion 工具

/**
 * 权限请求状态
 */
export type PermissionStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

/**
 * 权限响应选项（对应 Claude Code 的响应）
 */
export type PermissionChoice =
  | 'yes'           // 允许此操作
  | 'yesAlways'     // 允许并记住此选择
  | 'no'            // 拒绝此操作
  | 'noAlways'      // 拒绝并记住此选择
  | 'exit'          // 退出对话

/**
 * 权限请求
 */
export interface PermissionRequest {
  /** 唯一 ID */
  id: string
  /** 请求类型 */
  type: PermissionToolType
  /** 对应的 Claude Code 工具类型 */
  toolType: ClaudeToolType
  /** 请求标题 */
  title: string
  /** 请求描述 */
  description: string
  /** 相关文件/资源路径（可选） */
  resourcePath?: string
  /** 命令内容（对于 Bash 工具） */
  command?: string
  /** 请求详情（可选） */
  details?: string[]
  /** 创建时间 */
  createdAt: number
  /** 状态 */
  status: PermissionStatus
  /** 来源设备（desktop 或 mobile） */
  source: 'desktop' | 'mobile'
  /** Claude 会话请求 ID（用于将响应发送回正确的会话） */
  claudeRequestId?: string
}

/**
 * 权限响应
 */
export interface PermissionResponse {
  /** 请求 ID */
  requestId: string
  /** 用户选择 */
  choice: PermissionChoice
  /** 响应时间 */
  timestamp: number
  /** 响应来源设备 */
  source: 'desktop' | 'mobile'
}

/**
 * 权限规则（用于记住用户选择）
 */
export interface PermissionRule {
  /** 工具类型 */
  toolType: ClaudeToolType
  /** 模式匹配（如 "npm run *" 或 "./.env"） */
  pattern?: string
  /** 是否允许 */
  allow: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * WebSocket 消息类型
 */
export type WSMessageType =
  | 'permission_request'
  | 'permission_response'
  | 'sync_status'
  | 'ping'
  | 'pong'

/**
 * WebSocket 消息
 */
export interface WSMessage {
  type: WSMessageType
  payload: PermissionRequest | PermissionResponse | Record<string, unknown>
  timestamp: number
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

//
// Happy 架构改进类型导出
//
export type {
  // Content Blocks
  TextContent,
  ToolUseContent,
  ToolResultContent,
  MessageContent,
  // Tool Calls
  ToolCall,
  ToolCallState,
  ToolPermission, // This is the runtime permission status from message.ts
  // Messages
  Message,
  MessageKind,
  UserTextMessage,
  AgentTextMessage,
  ToolCallMessage,
  ModeSwitchMessage,
  AgentEvent,
  MessageMeta,
  EnhancedMessage,
  UsageData,
  // WebSocket Updates
  WSUpdateType,
  ActivityUpdate,
  SessionStateUpdate,
  MessageUpdate,
  // Session State
  SessionState,
} from './message'

//
// Controlled AI Operations - 类型导出
//
export type {
  ToolPermissionConfig,
  ApprovalDecision,
  ToolCallRequest,
  UserPreferences,
  LogLevel,
  OperationStatus,
  LogCategory,
  LogEntry,
  LogFilter,
  OperationType,
  SnapshotType,
  FileSnapshot,
  BrowserStateSnapshot,
  DirectorySnapshot,
  OperationRecord,
  Timeline,
  MCPToolDefinition,
  SSEConnectionInfo
} from './operation'
