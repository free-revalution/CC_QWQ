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
  params: Record<string, unknown>
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
  details?: unknown
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

// ==================== 检查点 ====================

/**
 * 检查点
 */
export interface Checkpoint {
  /** 唯一 ID (UUID) */
  id: string
  /** 检查点名称 (格式: checkpoint-YYYYMMDD-HHMMSS) */
  name: string
  /** 描述 (如 "Auto: Write config.json") */
  description: string
  /** 创建时间戳 */
  timestamp: number
  /** 包含的文件快照映射 (文件路径 -> 快照ID) */
  fileSnapshots: Map<string, string>
}

/**
 * 回滚结果
 */
export interface RollbackResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 回滚的检查点 ID */
  checkpointId?: string
  /** 回滚的文件列表 */
  files?: Array<{
    path: string
    snapshotId: string
    success: boolean
  }>
}

/**
 * 回滚预览
 */
export interface RollbackPreview {
  /** 将要回滚的文件 */
  files: Array<{
    path: string
    currentSize: number
    oldSize: number
    willDelete: boolean
  }>
  /** 是否可以回滚 */
  canRollback: boolean
  /** 警告信息 */
  warnings: string[]
}

// ==================== 时间线 ====================

/**
 * 时间线条目
 */
export interface TimelineEntry {
  /** 唯一 ID */
  id: string
  /** 时间戳 */
  timestamp: number
  /** 工具名称 */
  tool: string
  /** 状态 */
  status: 'pending' | 'approved' | 'denied' | 'success' | 'error'
  /** 持续时间（毫秒） */
  duration?: number
  /** 参数摘要 */
  summary: string
}

// ==================== 日志导出 ====================

/**
 * 导出格式
 */
export type ExportFormat = 'json' | 'csv' | 'markdown'

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 格式 */
  format: ExportFormat
  /** 时间范围 */
  timeRange?: {
    start: number
    end: number
  }
  /** 操作类型过滤 */
  toolFilter?: string[]
  /** 状态过滤 */
  statusFilter?: OperationStatus[]
}

/**
 * 操作记录
 */
export interface OperationRecord {
  id: string
  type: OperationType
  timestamp: number
  params: Record<string, unknown>
  result?: unknown
  error?: string
  snapshotBefore: SnapshotType
  rollbackData?: unknown
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
