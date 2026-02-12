# Phase 1: MCP 代理服务器、审批引擎、日志系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建可控 AI 操作系统的基础框架 - MCP 代理服务器（SSE 模式）、审批引擎（规则匹配）、日志系统（实时推送）

**Architecture:**
- MCP 代理运行在 Electron 主进程内，通过 SSE 与 Claude Code 通信
- 审批引擎拦截所有工具调用，执行权限检查和规则匹配
- 日志系统通过 IPC 向渲染进程推送实时日志

**Tech Stack:**
- @modelcontextprotocol/sdk (官方 MCP SDK)
- Express (HTTP 服务器，SSE 传输)
- TypeScript
- Electron IPC

---

## Phase 1.1: 安装依赖和创建类型定义

### Task 1.1: 安装 npm 依赖包

**Files:**
- Modify: `package.json`

**Step 1: 添加依赖到 package.json**

在 `package.json` 的 `dependencies` 中添加：

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "express": "^4.18.2",
    "minimatch": "^9.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21"
  }
}
```

**Step 2: 运行 npm install**

```bash
npm install
```

Expected: 依赖安装成功，无错误

**Step 3: 验证安装**

```bash
npm list @modelcontextprotocol/sdk express minimatch
```

Expected: 显示已安装的版本号

**Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "deps: add MCP SDK, Express, and minimatch for Phase 1"
```

---

### Task 1.2: 创建操作相关类型定义

**Files:**
- Create: `src/types/operation.ts`

**Step 1: 创建类型定义文件**

```typescript
/**
 * 操作相关类型定义
 * 用于可控 AI 操作系统
 */

// ==================== 工具权限 ====================

/**
 * 工具权限配置
 */
export interface ToolPermission {
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
```

**Step 2: 验证 TypeScript 编译**

```bash
npm run type-check 2>&1 | head -20
```

Expected: 无类型错误

**Step 3: 提交**

```bash
git add src/types/operation.ts
git commit -m "feat: add operation types for controlled AI system"
```

---

## Phase 1.2: 实现日志系统 (Operation Logger)

### Task 2.1: 创建日志收集器核心类

**Files:**
- Create: `electron/operationLogger.ts`

**Step 1: 创建日志收集器基础类**

```typescript
/**
 * Operation Logger - 操作日志收集器
 *
 * 收集所有操作事件，通过 IPC 推送到渲染进程
 */

import { EventEmitter } from 'events'
import type {
  LogEntry,
  LogFilter,
  LogLevel,
  OperationStatus,
  LogCategory
} from '../types/operation.js'

export class OperationLogger extends EventEmitter {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private subscribers: Set<(log: LogEntry) => void> = new Set()

  constructor() {
    super()
  }

  // ==================== 日志记录方法 ====================

  /**
   * 工具调用开始
   */
  logToolStart(tool: string, params: any, metadata?: any): void {
    this.log({
      level: 'info',
      status: 'running',
      category: 'tool',
      tool,
      title: `执行工具: ${tool}`,
      message: this.formatToolMessage(tool, params),
      details: { params },
      metadata
    })
  }

  /**
   * 等待用户批准
   */
  logAwaitingApproval(tool: string, params: any, approvalId: string): void {
    this.log({
      level: 'warning',
      status: 'awaiting_approval',
      category: 'approval',
      tool,
      title: `等待批准: ${tool}`,
      message: `等待用户确认操作`,
      details: { params, approvalId }
    })
  }

  /**
   * 批准操作
   */
  logApprovalGranted(tool: string, autoApproved: boolean): void {
    this.log({
      level: 'success',
      status: 'running',
      category: 'approval',
      tool,
      title: `已批准: ${tool}`,
      message: autoApproved ? '自动批准（匹配规则）' : '用户已批准'
    })
  }

  /**
   * 拒绝操作
   */
  logApprovalDenied(tool: string, reason: string): void {
    this.log({
      level: 'error',
      status: 'denied',
      category: 'approval',
      tool,
      title: `已拒绝: ${tool}`,
      message: reason
    })
  }

  /**
   * 工具执行成功
   */
  logToolSuccess(tool: string, result: any, duration: number): void {
    this.log({
      level: 'success',
      status: 'completed',
      category: 'tool',
      tool,
      title: `完成: ${tool}`,
      message: `操作成功完成，耗时 ${this.formatDuration(duration)}`,
      details: { result },
      duration
    })
  }

  /**
   * 工具执行失败
   */
  logToolError(tool: string, error: Error | string, duration?: number): void {
    this.log({
      level: 'error',
      status: 'failed',
      category: 'tool',
      tool,
      title: `失败: ${tool}`,
      message: typeof error === 'string' ? error : error.message,
      details: { error: typeof error === 'string' ? error : error.message },
      duration
    })
  }

  /**
   * 系统消息
   */
  logSystem(message: string, level: LogLevel = 'info'): void {
    this.log({
      level,
      status: 'completed',
      category: 'system',
      title: '系统',
      message
    })
  }

  // ==================== 核心日志方法 ====================

  /**
   * 添加日志条目
   */
  private log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const logEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...entry
    }

    // 添加到日志列表
    this.logs.push(logEntry)

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 推送到所有订阅者
    this.subscribers.forEach(callback => {
      try {
        callback(logEntry)
      } catch (error) {
        console.error('[OperationLogger] Subscriber error:', error)
      }
    })

    // 发送事件
    this.emit('log', logEntry)
    this.emit(`log:${logEntry.level}`, logEntry)
    this.emit(`log:${logEntry.status}`, logEntry)
  }

  // ==================== 日志查询与过滤 ====================

  /**
   * 获取所有日志
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * 根据过滤器获取日志
   */
  getFilteredLogs(filter: LogFilter): LogEntry[] {
    return this.logs.filter(log => {
      // 级别过滤
      if (filter.level && !filter.level.includes(log.level)) return false

      // 状态过滤
      if (filter.status && !filter.status.includes(log.status)) return false

      // 分类过滤
      if (filter.category && !filter.category.includes(log.category)) return false

      // 工具过滤
      if (filter.tool && log.tool && !filter.tool.includes(log.tool)) return false

      // 搜索查询
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase()
        const searchableText = [
          log.title,
          log.message,
          log.tool || '',
          JSON.stringify(log.details)
        ].join(' ').toLowerCase()

        if (!searchableText.includes(query)) return false
      }

      // 时间范围过滤
      if (filter.timeRange) {
        if (log.timestamp < filter.timeRange.start) return false
        if (log.timestamp > filter.timeRange.end) return false
      }

      return true
    })
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count)
  }

  /**
   * 获取特定工具的日志
   */
  getLogsForTool(tool: string): LogEntry[] {
    return this.logs.filter(log => log.tool === tool)
  }

  // ==================== 订阅机制 ====================

  /**
   * 订阅实时日志
   * @returns 取消订阅函数
   */
  subscribe(callback: (log: LogEntry) => void): () => void {
    this.subscribers.add(callback)

    return () => {
      this.subscribers.delete(callback)
    }
  }

  // ==================== 辅助方法 ====================

  private formatToolMessage(tool: string, params: any): string {
    switch (tool) {
      case 'browser_navigate':
        return `导航到 ${params.url || '未知 URL'}`
      case 'browser_click':
        return `点击元素: ${params.selector || '未知选择器'}`
      case 'file_read':
        return `读取文件: ${params.path || '未知路径'}`
      case 'file_write':
        const size = params.content ? `${params.content.length} 字节` : '0 字节'
        return `写入文件: ${params.path || '未知路径'} (${size})`
      case 'system_exec':
        return `执行命令: ${params.command || '未知命令'}`
      default:
        return JSON.stringify(params)
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = []
    this.emit('cleared')
  }

  /**
   * 导出日志
   */
  export(format: 'json' | 'text' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2)
    }

    // 文本格式
    return this.logs.map(log => {
      const time = new Date(log.timestamp).toISOString()
      const level = log.level.toUpperCase().padEnd(7)
      return `[${time}] ${level} [${log.category}] ${log.title}: ${log.message}`
    }).join('\n')
  }
}
```

**Step 2: 提交**

```bash
git add electron/operationLogger.ts
git commit -m "feat: add OperationLogger class for real-time log collection"
```

---

### Task 2.2: 在主进程中集成日志系统

**Files:**
- Modify: `electron/main.ts`

**Step 1: 在 main.ts 顶部导入 OperationLogger**

在 `electron/main.ts` 的导入区域添加：

```typescript
import { OperationLogger } from './operationLogger.js'
```

**Step 2: 创建全局日志实例**

在 `electron/main.ts` 中 `mobileClients` 声明之后添加：

```typescript
// 操作日志系统
export const operationLogger = new OperationLogger()
```

**Step 3: 添加 IPC 日志订阅处理器**

在 `electron/main.ts` 中 IPC handlers 区域添加（在 `ipcMain.handle` 部分之后）：

```typescript
// ==================== 操作日志 IPC ====================

// 订阅实时日志
ipcMain.on('subscribe-to-logs', (event) => {
  console.log('[IPC] Client subscribed to logs')

  const unsubscribe = operationLogger.subscribe((log) => {
    // 发送日志到客户端
    if (!event.sender.isDestroyed()) {
      event.sender.send('log-entry', log)
    }
  })

  // 清理时取消订阅
  event.sender.on('destroyed', () => {
    unsubscribe()
  })

  event.sender.on('disconnect', () => {
    unsubscribe()
  })
})

// 获取历史日志
ipcMain.handle('get-logs', async (event, filter?: any) => {
  console.log('[IPC] get-logs called, filter:', filter)

  if (filter) {
    return operationLogger.getFilteredLogs(filter)
  }
  return operationLogger.getAllLogs()
})

// 清空日志
ipcMain.handle('clear-logs', async () => {
  console.log('[IPC] clear-logs called')
  operationLogger.clear()
  return { success: true }
})

// 导出日志
ipcMain.handle('export-logs', async (event, format: 'json' | 'text' = 'json') => {
  console.log('[IPC] export-logs called, format:', format)
  return operationLogger.export(format)
})
```

**Step 4: 提交**

```bash
git add electron/main.ts
git commit -m "feat: integrate OperationLogger with IPC handlers"
```

---

## Phase 1.3: 实现审批引擎 (Approval Engine)

### Task 3.1: 创建审批引擎核心类

**Files:**
- Create: `electron/approvalEngine.ts`

**Step 1: 创建审批引擎类**

```typescript
/**
 * Approval Engine - 审批引擎
 *
 * 控制工具调用的权限，执行规则匹配和用户确认
 */

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import type * as minimatch from 'minimatch'
import type {
  ToolPermission,
  ApprovalDecision,
  ToolCallRequest,
  UserPreferences
} from '../types/operation.js'

// 简单的 minimatch 实现（避免依赖）
function matchesPattern(value: string, pattern: string): boolean {
  // 简化的 glob 匹配
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(regex).test(value)
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.startsWith('!')) {
      // 否定模式
      const regex = pattern.substring(1).replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      return !new RegExp(regex).test(value)
    }
    return matchesPattern(value, pattern)
  })
}

/**
 * 默认工具权限配置
 */
const DEFAULT_TOOL_PERMISSIONS: Map<string, ToolPermission> = new Map([
  // 浏览器工具
  ['browser_navigate', {
    tool: 'browser_navigate',
    requiresApproval: true,
    riskLevel: 'medium',
    autoApprovePatterns: [
      'https://docs.claude.com/**',
      'https://github.com/**'
    ],
    sandboxConstraints: {
      allowedUrls: ['https://**']
    }
  }],
  ['browser_click', {
    tool: 'browser_click',
    requiresApproval: false,
    riskLevel: 'low'
  }],
  ['browser_screenshot', {
    tool: 'browser_screenshot',
    requiresApproval: false,
    riskLevel: 'low'
  }],

  // 文件工具
  ['sandbox_read_file', {
    tool: 'sandbox_read_file',
    requiresApproval: false,
    riskLevel: 'low',
    sandboxConstraints: {
      allowedPaths: [
        process.env.HOME + '/development/**',
        '!**/.env',
        '!**/secrets/**',
        '!**/*.key',
        '!**/*.pem'
      ]
    }
  }],
  ['sandbox_write_file', {
    tool: 'sandbox_write_file',
    requiresApproval: true,
    riskLevel: 'high',
    sandboxConstraints: {
      allowedPaths: [
        process.env.HOME + '/development/**',
        '!**/*.exe',
        '!**/*.sh',
        '!**/package-lock.json',
        '!**/.env'
      ],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    }
  }],

  // 系统工具
  ['system_exec', {
    tool: 'system_exec',
    requiresApproval: true,
    riskLevel: 'high',
    autoApprovePatterns: [
      'git status',
      'git diff',
      'git log',
      'ls -la',
      'pwd',
      'cat *.md',
      'echo *'
    ]
  }]
])

export class ApprovalEngine extends EventEmitter {
  private toolPermissions: Map<string, ToolPermission>
  private userPreferences: UserPreferences
  private rememberedChoices: Map<string, 'once' | 'always'> = new Map()
  private pendingApprovals: Map<string, {
    resolve: (decision: ApprovalDecision) => void
    request: ToolCallRequest
  }> = new Map()

  constructor(customPermissions?: Map<string, ToolPermission>) {
    super()
    this.toolPermissions = customPermissions || DEFAULT_TOOL_PERMISSIONS
    this.userPreferences = {
      autoApproveLowRisk: true,
      requireConfirmation: true,
      rememberChoices: true,
      notificationLevel: 'risky'
    }
  }

  /**
   * 主入口：评估工具调用请求
   */
  async evaluate(request: ToolCallRequest): Promise<ApprovalDecision> {
    const { tool, params } = request
    const permission = this.toolPermissions.get(tool)

    // 未配置的工具，需要批准
    if (!permission) {
      return await this.requestUserApproval(request, {
        approved: false,
        reason: `Unknown tool: ${tool}. Please configure permissions first.`
      })
    }

    // 检查沙盒约束
    const sandboxCheck = this.checkSandboxConstraints(tool, params, permission)
    if (!sandboxCheck.passed) {
      return {
        approved: false,
        autoApproved: false,
        reason: sandboxCheck.reason
      }
    }

    // 检查是否有记住的选择
    const choiceKey = this.getChoiceKey(request)
    if (this.rememberedChoices.has(choiceKey)) {
      const choice = this.rememberedChoices.get(choiceKey)
      if (choice === 'always') {
        return {
          approved: true,
          autoApproved: true,
          reason: 'Auto-approved (remembered user choice)'
        }
      }
    }

    // 检查自动批准模式
    if (permission.autoApprovePatterns) {
      for (const pattern of permission.autoApprovePatterns) {
        if (this.matchesRequest(request, pattern)) {
          return {
            approved: true,
            autoApproved: true,
            reason: `Auto-approved (matched pattern: ${pattern})`
          }
        }
      }
    }

    // 低风险操作 + 自动批准启用
    if (permission.riskLevel === 'low' && this.userPreferences.autoApproveLowRisk) {
      return {
        approved: true,
        autoApproved: true,
        reason: 'Auto-approved (low risk operation)'
      }
    }

    // 需要用户批准
    if (permission.requiresApproval && this.userPreferences.requireConfirmation) {
      return await this.requestUserApproval(request, permission)
    }

    // 默认批准
    return {
      approved: true,
      autoApproved: false,
      reason: 'Approved (default behavior)'
    }
  }

  /**
   * 请求用户批准
   */
  private async requestUserApproval(
    request: ToolCallRequest,
    context: ToolPermission | { reason: string }
  ): Promise<ApprovalDecision> {
    const requestId = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve) => {
      // 存储待处理的请求
      this.pendingApprovals.set(requestId, { resolve, request })

      // 发送事件到渲染进程
      this.sendToRenderer('approval-request', {
        requestId,
        tool: request.tool,
        params: request.params,
        riskLevel: 'riskLevel' in context ? context.riskLevel : 'medium',
        reason: 'reason' in context ? context.reason : undefined
      })

      // 超时自动拒绝（60秒）
      const timeout = setTimeout(() => {
        if (this.pendingApprovals.has(requestId)) {
          this.pendingApprovals.delete(requestId)
          resolve({
            approved: false,
            autoApproved: false,
            reason: 'Approval timeout (60 seconds)'
          })
        }
      }, 60000)

      // 清理超时
      this.once(`approval-resolved-${requestId}`, () => {
        clearTimeout(timeout)
      })
    })
  }

  /**
   * 处理用户响应
   */
  handleUserResponse(
    requestId: string,
    choice: 'approve' | 'deny',
    remember: 'once' | 'always'
  ): void {
    const pending = this.pendingApprovals.get(requestId)
    if (!pending) {
      console.warn(`[ApprovalEngine] No pending request for: ${requestId}`)
      return
    }

    const decision: ApprovalDecision = {
      approved: choice === 'approve',
      autoApproved: false,
      reason: choice === 'approve'
        ? `User approved (${remember})`
        : 'User denied',
      userChoice: remember
    }

    // 记住用户选择
    if (choice === 'approve' && remember === 'always') {
      const choiceKey = this.getChoiceKey(pending.request)
      this.rememberedChoices.set(choiceKey, 'always')
      console.log(`[ApprovalEngine] Remembered choice for: ${choiceKey}`)
    }

    // 清理
    this.pendingApprovals.delete(requestId)
    this.emit(`approval-resolved-${requestId}`)

    // 解除等待
    pending.resolve(decision)
  }

  /**
   * 检查沙盒约束
   */
  private checkSandboxConstraints(
    tool: string,
    params: any,
    permission: ToolPermission
  ): { passed: boolean; reason?: string } {
    if (!permission.sandboxConstraints) return { passed: true }

    const { allowedPaths, allowedUrls, maxFileSize } = permission.sandboxConstraints

    // 检查路径约束
    if (allowedPaths && params.path) {
      if (!matchesAnyPattern(params.path, allowedPaths)) {
        return {
          passed: false,
          reason: `Path not in allowed sandbox: ${params.path}`
        }
      }
    }

    // 检查 URL 约束
    if (allowedUrls && params.url) {
      if (!matchesAnyPattern(params.url, allowedUrls)) {
        return {
          passed: false,
          reason: `URL not in allowed list: ${params.url}`
        }
      }
    }

    // 检查文件大小
    if (maxFileSize && params.content) {
      const size = Buffer.byteLength(params.content, 'utf8')
      if (size > maxFileSize) {
        return {
          passed: false,
          reason: `Content too large: ${size} bytes (max: ${maxFileSize})`
        }
      }
    }

    return { passed: true }
  }

  /**
   * 生成选择键
   */
  private getChoiceKey(request: ToolCallRequest): string {
    return `${request.tool}:${JSON.stringify(request.params)}`
  }

  /**
   * 匹配请求到模式
   */
  private matchesRequest(request: ToolCallRequest, pattern: string): boolean {
    // 简化实现：将请求转换为字符串后匹配
    const requestStr = JSON.stringify(request.params)
    return matchesPattern(requestStr, pattern)
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  /**
   * 更新用户偏好
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences }
    console.log('[ApprovalEngine] Preferences updated:', this.userPreferences)
  }

  /**
   * 获取用户偏好
   */
  getPreferences(): UserPreferences {
    return { ...this.userPreferences }
  }

  /**
   * 清除记住的选择
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear()
    console.log('[ApprovalEngine] Cleared remembered choices')
  }
}
```

**Step 2: 提交**

```bash
git add electron/approvalEngine.ts
git commit -m "feat: add ApprovalEngine with permission checking and user confirmation"
```

---

### Task 3.2: 在主进程中集成审批引擎

**Files:**
- Modify: `electron/main.ts`

**Step 1: 导入 ApprovalEngine**

在 `electron/main.ts` 中添加导入：

```typescript
import { ApprovalEngine } from './approvalEngine.js'
```

**Step 2: 创建全局审批引擎实例**

在 `operationLogger` 声明之后添加：

```typescript
// 审批引擎
export const approvalEngine = new ApprovalEngine()
```

**Step 3: 添加审批相关 IPC 处理器**

```typescript
// ==================== 审批引擎 IPC ====================

// 处理用户审批响应
ipcMain.on('approval-response', (event, data) => {
  console.log('[IPC] approval-response:', data)
  approvalEngine.handleUserResponse(
    data.requestId,
    data.choice,
    data.remember
  )
})

// 获取用户偏好
ipcMain.handle('get-approval-preferences', async () => {
  return approvalEngine.getPreferences()
})

// 更新用户偏好
ipcMain.handle('update-approval-preferences', async (event, preferences) => {
  approvalEngine.updatePreferences(preferences)
  return { success: true }
})

// 清除记住的选择
ipcMain.handle('clear-remembered-choices', async () => {
  approvalEngine.clearRememberedChoices()
  return { success: true }
})
```

**Step 4: 提交**

```bash
git add electron/main.ts
git commit -m "feat: integrate ApprovalEngine with IPC handlers"
```

---

## Phase 1.4: 实现 MCP 代理服务器 (基础框架)

### Task 4.1: 创建 MCP 代理服务器类

**Files:**
- Create: `electron/mcpProxyServer.ts`

**Step 1: 创建 MCP 代理服务器基础类**

```typescript
/**
 * MCP Proxy Server - MCP 代理服务器
 *
 * 通过 SSE 协议与 Claude Code 通信，代理工具调用请求
 */

import { EventEmitter } from 'events'
import express from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { MCPToolDefinition, SSEConnectionInfo } from '../types/operation.js'
import type { ApprovalEngine } from './approvalEngine.js'
import type { OperationLogger } from './operationLogger.js'

export class MCPProxyServer extends EventEmitter {
  private server: Server | null = null
  private httpServer: any = null
  private port: number
  private approvalEngine: ApprovalEngine
  private operationLogger: OperationLogger

  constructor(
    port: number,
    approvalEngine: ApprovalEngine,
    operationLogger: OperationLogger
  ) {
    super()
    this.port = port
    this.approvalEngine = approvalEngine
    this.operationLogger = operationLogger
  }

  /**
   * 启动 MCP 代理服务器
   */
  async start(): Promise<void> {
    console.log(`[MCP Proxy] Starting on port ${this.port}...`)

    // 创建 Express 应用
    const app = express()

    // SSE 端点
    app.get('/mcp', async (req: any, res: any) => {
      console.log('[MCP Proxy] New SSE connection from Claude Code')

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      // 创建 SSE 传输层
      const transport = new SSEServerTransport('/message', res)

      // 创建或获取 MCP 服务器实例
      if (!this.server) {
        this.server = new Server(
          {
            name: 'claudephone-mcp-proxy',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          }
        )

        this.setupHandlers()
      }

      try {
        // 连接传输层
        await this.server.connect(transport)
        console.log('[MCP Proxy] Client connected successfully')

        this.emit('client-connected')
      } catch (error) {
        console.error('[MCP Proxy] Failed to connect client:', error)
        res.end()
      }
    })

    // 消息端点（SSE 数据传输）
    app.use('/message', express.json())

    // 健康检查端点
    app.get('/health', (req: any, res: any) => {
      res.json({
        status: 'ok',
        port: this.port,
        timestamp: Date.now()
      })
    })

    // 启动 HTTP 服务器
    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(this.port, () => {
        console.log(`[MCP Proxy] HTTP server listening on port ${this.port}`)
        this.operationLogger.logSystem(
          `MCP Proxy Server started on http://localhost:${this.port}/mcp`,
          'success'
        )
        resolve()
      })

      this.httpServer.on('error', (error: any) => {
        console.error('[MCP Proxy] HTTP server error:', error)
        reject(error)
      })
    })
  }

  /**
   * 设置 MCP 请求处理器
   */
  private setupHandlers(): void {
    if (!this.server) return

    // 列出可用工具
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => {
        console.log('[MCP Proxy] ListTools request')
        return {
          tools: this.getAvailableTools()
        }
      }
    )

    // 处理工具调用
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params
        console.log(`[MCP Proxy] Tool call: ${name}`, args)

        // 记录工具调用开始
        this.operationLogger.logToolStart(name, args)

        // 审批检查
        const decision = await this.approvalEngine.evaluate({
          tool: name,
          params: args,
          source: 'claude-code'
        })

        if (!decision.approved) {
          this.operationLogger.logApprovalDenied(name, decision.reason)
          return {
            content: [{
              type: 'text',
              text: `Tool call denied: ${decision.reason}`
            }],
            isError: false
          }
        }

        // 记录批准
        this.operationLogger.logApprovalGranted(name, decision.autoApproved)

        // 执行工具（暂时返回模拟结果）
        const result = await this.executeTool(name, args)

        // 记录成功
        this.operationLogger.logToolSuccess(name, result, 0)

        return result
      }
    )
  }

  /**
   * 获取可用工具列表
   */
  private getAvailableTools(): MCPToolDefinition[] {
    return [
      // 浏览器工具
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL in controlled browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to navigate to (must be in whitelist)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'browser_click',
        description: 'Click an element on current page',
        inputSchema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector'
            }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_screenshot',
        description: 'Take screenshot of current page',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },

      // 文件工具
      {
        name: 'sandbox_read_file',
        description: 'Read a file from the allowed sandbox directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path within sandbox'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'sandbox_write_file',
        description: 'Write content to a file in the sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path within sandbox'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            }
          },
          required: ['path', 'content']
        }
      },

      // 系统工具
      {
        name: 'system_exec',
        description: 'Execute a command in the project directory',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute'
            },
            description: {
              type: 'string',
              description: 'What this command does'
            }
          },
          required: ['command', 'description']
        }
      }
    ]
  }

  /**
   * 执行工具（暂时返回模拟结果）
   */
  private async executeTool(name: string, args: any): Promise<any> {
    // TODO: Phase 3 实现实际执行逻辑
    switch (name) {
      case 'browser_navigate':
        return {
          content: [{
            type: 'text',
            text: `Navigation to ${args.url} initiated (not yet implemented)`
          }]
        }

      case 'browser_click':
        return {
          content: [{
            type: 'text',
            text: `Click on ${args.selector} initiated (not yet implemented)`
          }]
        }

      case 'browser_screenshot':
        return {
          content: [{
            type: 'text',
            text: 'Screenshot captured (not yet implemented)'
          }],
          metadata: {
            screenshot: 'base64-screenshot-data-placeholder'
          }
        }

      case 'sandbox_read_file':
        return {
          content: [{
            type: 'text',
            text: `File content from ${args.path} (not yet implemented)`
          }]
        }

      case 'sandbox_write_file':
        return {
          content: [{
            type: 'text',
            text: `Wrote ${args.content?.length || 0} bytes to ${args.path} (not yet implemented)`
          }]
        }

      case 'system_exec':
        return {
          content: [{
            type: 'text',
            text: `Executed: ${args.command} (not yet implemented)`
          }]
        }

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`
          }],
          isError: true
        }
    }
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(): SSEConnectionInfo {
    return {
      port: this.port,
      endpoint: `http://localhost:${this.port}/mcp`,
      healthEndpoint: `http://localhost:${this.port}/health`
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    console.log('[MCP Proxy] Stopping server...')

    if (this.server) {
      await this.server.close()
      this.server = null
    }

    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log('[MCP Proxy] Server stopped')
          resolve()
        })
      })
    }
  }
}
```

**Step 2: 提交**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: add MCPProxyServer with SSE transport and tool definitions"
```

---

### Task 4.2: 在主进程中启动 MCP 代理服务器

**Files:**
- Modify: `electron/main.ts`

**Step 1: 导入 MCPProxyServer**

```typescript
import { MCPProxyServer } from './mcpProxyServer.js'
```

**Step 2: 创建 MCP 代理实例并启动**

在 `app.whenReady()` 中添加启动逻辑：

```typescript
// 在 app.whenReady().then(async () => { ... }) 内部添加

// 启动 MCP 代理服务器
const MCP_PROXY_PORT = 3010
try {
  const mcpProxyServer = new MCPProxyServer(
    MCP_PROXY_PORT,
    approvalEngine,
    operationLogger
  )
  await mcpProxyServer.start()
  console.log('[Main] MCP Proxy Server started successfully')

  // 存储到全局以便后续使用
  ;(global as any).mcpProxyServer = mcpProxyServer
} catch (error) {
  console.error('[Main] Failed to start MCP Proxy Server:', error)
}
```

**Step 3: 添加应用退出时清理**

在 `app.on('before-quit')` 处理器中添加：

```typescript
// 停止 MCP 代理服务器
if ((global as any).mcpProxyServer) {
  await (global as any).mcpProxyServer.stop()
}
```

**Step 4: 提交**

```bash
git add electron/main.ts
git commit -m "feat: start MCPProxyServer on app startup"
```

---

## Phase 1.5: 前端类型定义和 IPC 封装

### Task 5.1: 更新类型定义

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 添加操作相关类型导出**

在 `src/types/index.ts` 末尾添加：

```typescript
//
// Controlled AI Operations - 类型导出
//
export type {
  ToolPermission,
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
```

**Step 2: 更新 ElectronAPI 接口

在 `ElectronAPI` 接口中添加日志和审批相关方法：

```typescript
  // 在 ElectronAPI 接口中添加

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
```

**Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add operation types to exports and ElectronAPI interface"
```

---

### Task 5.2: 更新 IPC 封装

**Files:**
- Modify: `src/lib/ipc.ts`

**Step 1: 添加日志和审批相关 IPC 封装**

在 `src/lib/ipc.ts` 中 `removeListener` 方法之前添加：

```typescript
  // ==================== 操作日志 ====================

  /**
   * 订阅实时日志
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onLogEntry: (callback: (data: import('../types/operation').LogEntry) => void) => {
    if (window.electronAPI?.onLogEntry) {
      const handler = (_event: any, data: any) => callback(data)
      // 使用 ipcRenderer.on 监听
      if (window.electronAPI.ipcRenderer) {
        window.electronAPI.ipcRenderer.on('log-entry', handler)
        const cleanupId = `log-entry-${Date.now()}`
        return cleanupId
      }
    }
    console.warn('electronAPI.onLogEntry not available')
    return ''
  },

  /**
   * 获取日志
   */
  getLogs: async (filter?: import('../types/operation').LogFilter) => {
    if (window.electronAPI?.getLogs) {
      return window.electronAPI.getLogs(filter)
    }
    console.warn('electronAPI.getLogs not available')
    return []
  },

  /**
   * 清空日志
   */
  clearLogs: async () => {
    if (window.electronAPI?.clearLogs) {
      return window.electronAPI.clearLogs()
    }
    console.warn('electronAPI.clearLogs not available')
    return { success: false }
  },

  /**
   * 导出日志
   */
  exportLogs: async (format: 'json' | 'text' = 'json') => {
    if (window.electronAPI?.exportLogs) {
      return window.electronAPI.exportLogs(format)
    }
    console.warn('electronAPI.exportLogs not available')
    return ''
  },

  // ==================== 审批引擎 ====================

  /**
   * 发送审批响应
   */
  sendApprovalResponse: (response: {
    requestId: string
    choice: 'approve' | 'deny'
    remember: 'once' | 'always'
  }) => {
    if (window.electronAPI?.sendApprovalResponse) {
      window.electronAPI.sendApprovalResponse(response)
    } else {
      console.warn('electronAPI.sendApprovalResponse not available')
    }
  },

  /**
   * 获取审批偏好设置
   */
  getApprovalPreferences: async () => {
    if (window.electronAPI?.getApprovalPreferences) {
      return window.electronAPI.getApprovalPreferences()
    }
    console.warn('electronAPI.getApprovalPreferences not available')
    return {
      autoApproveLowRisk: true,
      requireConfirmation: true,
      rememberChoices: true,
      notificationLevel: 'risky'
    }
  },

  /**
   * 更新审批偏好设置
   */
  updateApprovalPreferences: async (preferences: Partial<{
    autoApproveLowRisk: boolean
    requireConfirmation: boolean
    rememberChoices: boolean
    notificationLevel: 'all' | 'risky' | 'errors'
  }>) => {
    if (window.electronAPI?.updateApprovalPreferences) {
      return window.electronAPI.updateApprovalPreferences(preferences)
    }
    console.warn('electronAPI.updateApprovalPreferences not available')
    return { success: false }
  },

  /**
   * 清除记住的选择
   */
  clearRememberedChoices: async () => {
    if (window.electronAPI?.clearRememberedChoices) {
      return window.electronAPI.clearRememberedChoices()
    }
    console.warn('electronAPI.clearRememberedChoices not available')
    return { success: false }
  },
```

**Step 2: 提交**

```bash
git add src/lib/ipc.ts
git commit -m "feat: add IPC wrappers for logs and approval system"
```

---

### Task 5.3: 更新 preload.js

**Files:**
- Modify: `electron/preload.js`

**Step 1: 添加 IPC 暴露**

在 `electron/preload.js` 的 `contextBridge.exposeInMainWorld` 中添加：

```javascript
  // ==================== 操作日志 ====================

  onLogEntry: (callback) => {
    const handler = (_event, data) => callback(data)
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.on('log-entry', handler)
    }
    const cleanupId = `log-entry-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      if (window.electronAPI?.ipcRenderer) {
        window.electronAPI.ipcRenderer.removeListener('log-entry', handler)
      }
    })
    return cleanupId
  },
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  exportLogs: (format = 'json') => ipcRenderer.invoke('export-logs', format),

  // ==================== 审批引擎 ====================

  sendApprovalResponse: (response) => {
    if (window.electronAPI?.ipcRenderer) {
      window.electronAPI.ipcRenderer.send('approval-response', response)
    }
  },
  getApprovalPreferences: () => ipcRenderer.invoke('get-approval-preferences'),
  updateApprovalPreferences: (preferences) => ipcRenderer.invoke('update-approval-preferences', preferences),
  clearRememberedChoices: () => ipcRenderer.invoke('clear-remembered-choices'),
```

**Step 2: 确保 ipcRenderer 可用**

在 preload.js 顶部添加：

```javascript
const { contextBridge, ipcRenderer } = require('electron')

// 存储 ipcRenderer 引用以便使用
if (!window.electronAPI) {
  window.electronAPI = {}
}
window.electronAPI.ipcRenderer = ipcRenderer
```

**Step 3: 提交**

```bash
git add electron/preload.js
git commit -m "feat: expose logs and approval APIs in preload"
```

---

## Phase 1.6: 简单测试验证

### Task 6.1: 创建基础测试

**Files:**
- Create: `src/components/ui/OperationLogPanel.tsx`

**Step 1: 创建简化的日志面板组件（用于测试）**

```typescript
/**
 * Operation Log Panel - 简化版（Phase 1 测试用）
 */

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import type { LogEntry } from '../../types/operation'
import { ipc } from '../../lib/ipc'

export function OperationLogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState('')

  // 订阅实时日志
  useEffect(() => {
    const cleanupId = ipc.onLogEntry((log) => {
      console.log('[OperationLogPanel] Received log:', log)
      setLogs(prev => [...prev.slice(-99), log]) // 保留最近 100 条
    })

    // 初始加载历史日志
    ipc.getLogs().then(initialLogs => {
      console.log('[OperationLogPanel] Loaded logs:', initialLogs.length)
      setLogs(initialLogs)
    })

    return () => {
      if (cleanupId) {
        ipc.removeListener(cleanupId)
      }
    }
  }, [])

  // 状态图标
  const getStatusIcon = (status: LogEntry['status']) => {
    switch (status) {
      case 'running':
        return <Clock size={14} className="animate-spin text-blue-400" />
      case 'awaiting_approval':
        return <AlertCircle size={14} className="text-yellow-400" />
      case 'completed':
        return <CheckCircle size={14} className="text-green-400" />
      case 'failed':
      case 'denied':
        return <XCircle size={14} className="text-red-400" />
      default:
        return null
    }
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  // 过滤日志
  const filteredLogs = logs.filter(log => {
    if (!filter) return true
    const query = filter.toLowerCase()
    return log.title.toLowerCase().includes(query) ||
           log.message.toLowerCase().includes(query) ||
           (log.tool && log.tool.toLowerCase().includes(query))
  })

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">操作日志 (Phase 1 测试)</h3>
        <div className="text-sm text-secondary">
          {filteredLogs.length} 条日志
        </div>
      </div>

      {/* 搜索框 */}
      <input
        type="text"
        placeholder="搜索日志..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-2 mb-4 bg-white/5 border border-white/10 rounded-lg text-primary text-sm placeholder:text-secondary focus:outline-none focus:border-blue-500/50"
      />

      {/* 日志列表 */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            暂无日志
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-primary truncate">
                      {log.title}
                    </span>
                    {log.tool && (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-xs text-secondary">
                        {log.tool}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-secondary truncate">
                    {log.message}
                  </div>
                  <div className="text-xs text-secondary/60">
                    {formatTime(log.timestamp)}
                    {log.duration !== undefined && (
                      <span className="ml-2">({log.duration}ms)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

**Step 2: 提交**

```bash
git add src/components/ui/OperationLogPanel.tsx
git commit -m "feat: add simplified OperationLogPanel for Phase 1 testing"
```

---

### Task 6.2: 添加到 ConversationPage 进行测试

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 导入 OperationLogPanel**

```typescript
import OperationLogPanel from '../components/ui/OperationLogPanel'
```

**Step 2: 在 UI 中添加日志面板**

在合适位置添加（比如在主内容区底部）：

```typescript
{/* Phase 1 测试: 操作日志面板 */}
<div className="mt-4">
  <OperationLogPanel />
</div>
```

**Step 3: 提交**

```bash
git add src/pages/ConversationPage.tsx
git commit -m "feat: add OperationLogPanel to ConversationPage for testing"
```

---

## Phase 1.7: 最终测试和验证

### Task 7.1: 验证 MCP 代理服务器启动

**Step 1: 启动应用**

```bash
npm run electron:dev
```

**Step 2: 检查控制台输出**

Expected output:
```
[MCP Proxy] Starting on port 3010...
[MCP Proxy] HTTP server listening on port 3010
[Operation Logger] MCP Proxy Server started on http://localhost:3010/mcp
[Main] MCP Proxy Server started successfully
```

**Step 3: 测试健康检查端点**

```bash
curl http://localhost:3010/health
```

Expected response:
```json
{"status":"ok","port":3010,"timestamp":...}
```

---

### Task 7.2: 验证日志推送

**Step 1: 在应用中手动触发日志**

在浏览器开发者工具控制台中：

```javascript
// 手动触发系统日志测试
window.electronAPI?.invoke('clear-logs')?.then(() => {
  console.log('Logs cleared')
})

// 应该能看到日志面板清空
```

**Step 2: 验证日志订阅**

检查日志面板是否显示系统启动日志。

---

### Task 7.3: 验证审批引擎

**Step 1: 检查审批偏好**

在控制台中：

```javascript
window.electronAPI?.getApprovalPreferences().then(console.log)
```

Expected: 显示默认偏好设置

**Step 2: 最终提交**

```bash
git add .
git commit -m "test: Phase 1 complete - MCP proxy, approval engine, logger working"
```

---

## Phase 1 完成检查清单

- [ ] MCP SDK、Express、minimatch 依赖已安装
- [ ] 操作类型定义文件已创建
- [ ] OperationLogger 类已实现并集成
- [ ] ApprovalEngine 类已实现并集成
- [ ] MCPProxyServer 类已实现并启动
- [ ] IPC 通信已配置
- [ ] 前端类型定义已更新
- [ ] preload.js API 已暴露
- [ ] OperationLogPanel 组件已创建
- [ ] MCP 代理服务器成功启动在端口 3010
- [ ] 健康检查端点可访问
- [ ] 日志实时推送正常工作
- [ ] 审批引擎规则匹配正常

---

## 下一步

Phase 1 完成后，继续 Phase 2：
- 实现审批弹窗 UI (ApprovalDialog)
- 完善日志面板功能
- 集成 Playwright 浏览器自动化
- 实现文件操作执行器

---

**Plan created:** 2025-02-10
**For implementation:** Use superpowers:executing-plans or superpowers:subagent-driven-development
