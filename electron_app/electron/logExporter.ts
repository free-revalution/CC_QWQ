/**
 * LogExporter - 日志导出器
 *
 * 支持导出为 JSON、CSV、Markdown 三种格式
 */

import type { LogEntry, ExportOptions, ExportFormat } from '../src/types/operation.js'

export class LogExporter {
  /**
   * 导出日志
   */
  export(logs: LogEntry[], options: ExportOptions): string {
    // 过滤日志
    let filteredLogs = this.filterLogs(logs, options)

    switch (options.format) {
      case 'json':
        return this.exportJSON(filteredLogs)
      case 'csv':
        return this.exportCSV(filteredLogs)
      case 'markdown':
        return this.exportMarkdown(filteredLogs)
      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  }

  /**
   * 过滤日志
   */
  private filterLogs(logs: LogEntry[], options: ExportOptions): LogEntry[] {
    let filtered = [...logs]

    // 时间范围过滤
    if (options.timeRange) {
      const { start, end } = options.timeRange
      filtered = filtered.filter(log =>
        log.timestamp >= start && log.timestamp <= end
      )
    }

    // 工具过滤
    if (options.toolFilter && options.toolFilter.length > 0) {
      filtered = filtered.filter(log =>
        log.tool && options.toolFilter.includes(log.tool)
      )
    }

    // 状态过滤
    if (options.statusFilter && options.statusFilter.length > 0) {
      filtered = filtered.filter(log =>
        options.statusFilter.includes(log.status)
      )
    }

    return filtered
  }

  /**
   * 安全序列化对象（处理循环引用）
   */
  private safeStringify(obj: unknown): string {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return '[Cannot serialize: circular or invalid data]'
    }
  }

  /**
   * 导出为 JSON
   */
  private exportJSON(logs: LogEntry[]): string {
    return this.safeStringify({
      exportTime: new Date().toISOString(),
      totalOperations: logs.length,
      operations: logs
    })
  }

  /**
   * 导出为 CSV
   */
  private exportCSV(logs: LogEntry[]): string {
    const headers = ['Timestamp', 'Tool', 'Status', 'Duration', 'Summary']
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.tool || '',
      log.status,
      log.duration ? `${log.duration}ms` : '',
      this.summarizeParams(log.details)
    ])

    const csvRows = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))

    return csvRows.join('\n')
  }

  /**
   * 导出为 Markdown
   */
  private exportMarkdown(logs: LogEntry[]): string {
    const lines: string[] = []

    lines.push('# 操作日志导出')
    lines.push('')
    lines.push(`**生成时间**: ${new Date().toLocaleString()}`)
    lines.push(`**操作总数**: ${logs.length}`)
    lines.push('')

    // 统计信息
    const stats = {
      total: logs.length,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      successRate: '0' as string
    }

    logs.forEach(log => {
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1
      stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1
    })

    const successCount = (stats.byStatus['completed'] || 0) + (stats.byStatus['success'] || 0)
    stats.successRate = stats.total > 0 ? (successCount / stats.total * 100).toFixed(1) : '0'

    lines.push('## 统计摘要')
    lines.push('')
    lines.push(`- 总操作数: ${stats.total}`)
    lines.push(`- 成功率: ${stats.successRate}%`)

    lines.push('')
    lines.push('### 按分类')
    for (const [category, count] of Object.entries(stats.byCategory)) {
      lines.push(`- ${category}: ${count}`)
    }

    lines.push('')
    lines.push('## 详细记录')
    lines.push('')

    logs.forEach(log => {
      const statusIcon = this.getStatusIcon(log.status)
      const timeStr = new Date(log.timestamp).toLocaleString()

      lines.push(`### ${timeStr} - ${log.tool || 'System'}`)
      lines.push('')
      lines.push(`${statusIcon} ${log.status} ${log.duration ? `| ${log.duration}ms` : ''}`)
      lines.push('')
      lines.push(`**分类**: ${log.category}`)
      lines.push('')
      lines.push(`**标题**: ${log.title}`)
      lines.push('')
      lines.push(`**消息**: ${log.message}`)

      if (log.details) {
        lines.push('')
        lines.push('**详情**:')
        lines.push('```')
        lines.push(this.safeStringify(log.details))
        lines.push('```')
      }

      lines.push('')
    })

    return lines.join('\n')
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: string): string {
    const iconMap: Record<string, string> = {
      pending: '⏳',
      awaiting_approval: '🔵',
      running: '🔄',
      completed: '✅',
      success: '✅',
      failed: '❌',
      denied: '🚫'
    }
    return iconMap[status] || '📌'
  }

  /**
   * 生成参数摘要
   */
  private summarizeParams(details: unknown): string {
    if (!details || typeof details !== 'object') {
      return ''
    }

    const parts: string[] = []
    const obj = details as Record<string, unknown>

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'content') {
        // 跳过内容字段
        const str = String(value)
        parts.push(`${key}: ${str.length > 50 ? str.slice(0, 50) + '...' : str}`)
      } else if (typeof value === 'string' && value.length > 100) {
        parts.push(`${key}: ${value.slice(0, 100)}...`)
      } else {
        parts.push(`${key}: ${JSON.stringify(value)}`)
      }

      // 限制摘要长度
      if (parts.join(', ').length > 200) {
        break
      }
    }

    return parts.join(', ')
  }
}
