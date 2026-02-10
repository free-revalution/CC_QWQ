/**
 * 操作相关类型定义
 * 用于可控 AI 操作系统
 */

// ==================== 工具权限 ====================

/**
 * 工具权限配置
 */
export interface ToolPermissionConfig {
  /** 工具名称 */
  tool: string
  /** 是否需要用户批准 */
  requiresApproval: boolean
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high'
  /** 自动批准的模式匹配（glob 模式） */
  autoApprovePatterns?: string[]
  /** 沙盒约束 */
  sandboxConstraints?: {
    /** 允许的路径模式 */
    allowedPaths?: string[]
    /** 允许的 URL 模式 */
    allowedUrls?: string[]
    /** 最大文件大小（字节） */
    maxFileSize?: number
  }
}

// ==================== 审批决策 ====================

/**
 * 审批决策
 */
export interface ApprovalDecision {
  /** 是否批准 */
  approved: boolean
  /** 原因说明 */
  reason: string
  /** 是否自动批准 */
  autoApproved: boolean
  /** 用户选择 */
  userChoice?: 'once' | 'always' | 'session'
}

// ==================== 工具调用请求 ====================

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  /** 工具名称 */
  tool: string
  /** 参数 */
  params: Record<string, any>
  /** 来源 */
  source: 'claude-code' | 'user' | 'mobile'
}

// ==================== 日志系统 ====================

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 操作状态
 */
export type OperationStatus = 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'denied'

/**
 * 日志分类
 */
export type LogCategory = 'tool' | 'approval' | 'system' | 'rollback'

/**
 * 日志条目
 */
export interface LogEntry {
  /** 唯一 ID */
  id: string
  /** 时间戳 */
  timestamp: number
  /** 日志级别 */
  level: LogLevel
  /** 操作状态 */
  status: OperationStatus
  /** 分类 */
  category: LogCategory
  /** 工具名称（可选） */
  tool?: string
  /** 标题 */
  title: string
  /** 消息 */
  message: string
  /** 详细信息 */
  details?: any
  /** 持续时间（毫秒） */
  duration?: number
  /** 元数据 */
  metadata?: {
    /** 项目 ID */
    projectId?: string
    /** 对话 ID */
    conversationId?: string
    /** 用户 ID */
    userId?: string
  }
}

/**
 * 日志过滤器
 */
export interface LogFilter {
  /** 级别过滤 */
  level?: LogLevel[]
  /** 状态过滤 */
  status?: OperationStatus[]
  /** 分类过滤 */
  category?: LogCategory[]
  /** 工具过滤 */
  tool?: string[]
  /** 搜索查询 */
  searchQuery?: string
  /** 时间范围 */
  timeRange?: {
    start: number
    end: number
  }
}

// ==================== 操作执行器 ====================

/**
 * 操作类型
 */
export type OperationType =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'browser_navigate'
  | 'browser_click'
  | 'browser_screenshot'
  | 'system_exec'

/**
 * 快照类型
 */
export type SnapshotType = FileSnapshot | BrowserStateSnapshot | DirectorySnapshot

/**
 * 文件快照
 */
export interface FileSnapshot {
  type: 'file'
  path: string
  content: string
  hash: string
  timestamp: number
  size: number
  permissions?: string
}

/**
 * 浏览器状态快照
 */
export interface BrowserStateSnapshot {
  type: 'browser_state'
  url: string
  screenshot: string
  cookies: Array<{ name: string; value: string }>
  localStorage: Record<string, string>
  timestamp: number
}

/**
 * 目录快照
 */
export interface DirectorySnapshot {
  type: 'directory'
  path: string
  files: Map<string, FileSnapshot>
  timestamp: number
}

/**
 * 操作记录
 */
export interface OperationRecord {
  id: string
  type: OperationType
  timestamp: number
  params: any
  result?: any
  error?: string
  snapshotBefore: SnapshotType
  rollbackData?: any
  duration: number
}

/**
 * 时间线
 */
export interface Timeline {
  operations: OperationRecord[]
  checkpoints: Map<string, string>
  currentTime: number
}

// ==================== 用户偏好设置 ====================

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 自动批准低风险操作 */
  autoApproveLowRisk: boolean
  /** 需要确认对话框 */
  requireConfirmation: boolean
  /** 记住用户选择 */
  rememberChoices: boolean
  /** 通知级别 */
  notificationLevel: 'all' | 'risky' | 'errors'
}

// ==================== MCP 相关 ====================

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
}

/**
 * SSE 传输连接信息
 */
export interface SSEConnectionInfo {
  port: number
  endpoint: string
  healthEndpoint: string
}
