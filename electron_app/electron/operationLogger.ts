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
} from '../src/types/operation.js'

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
