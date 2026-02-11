# Phase 5: 高级功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标**: 实现时间线可视化、自动检查点管理、批量回滚、日志导出四大高级功能

**架构**: 新增CheckpointManager（自动创建快照）、RollbackEngine（批量回滚）、LogExporter（三种格式导出）、TimelinePanel（侧边面板UI组件），通过IPC与现有系统集成

**技术栈**: TypeScript + React (前端)、Node.js (主进程)、Playwright (浏览器)、SHA256 (快照校验)

---

## 任务分解

### Task 1: 扩展类型定义

**Files:**
- Modify: `src/types/operation.ts:150-187`
- Test: None (类型定义)

**Step 1: 添加检查点相关类型**

在 `src/types/operation.ts` 的 `SnapshotType` 部分后添加：

```typescript
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
```

**Step 2: Commit**

```bash
git add src/types/operation.ts
git commit -m "feat: add checkpoint, rollback, timeline, export types"
```

---

### Task 2: 创建 CheckpointManager 骨架

**Files:**
- Create: `electron/checkpointManager.ts`
- Test: None (主进程代码)

**Step 1: 创建 CheckpointManager 类**

```typescript
/**
 * CheckpointManager - 检查点管理器
 *
 * 自动为文件写入操作创建检查点，管理检查点生命周期
 */

import { randomUUID } from 'crypto'
import type { Checkpoint, FileSnapshot } from '../src/types/operation.js'

export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map()
  private readonly maxCheckpoints: number
  private readonly maxAge: number // 毫秒

  constructor(maxCheckpoints: number = 50, maxAgeDays: number = 7) {
    this.maxCheckpoints = maxCheckpoints
    this.maxAge = maxAgeDays * 24 * 60 * 60 * 1000
  }

  /**
   * 自动创建检查点
   */
  createAuto(filePath: string, snapshotId: string): Checkpoint {
    const now = Date.now()
    const date = new Date(now)

    // 生成检查点名称: checkpoint-YYYYMMDD-HHMMSS
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    const name = `checkpoint-${year}${month}${day}-${hours}${minutes}${seconds}`

    // 从路径提取文件名
    const fileName = filePath.split('/').pop() || filePath
    const description = `Auto: Write ${fileName}`

    const checkpoint: Checkpoint = {
      id: randomUUID(),
      name,
      description,
      timestamp: now,
      fileSnapshots: new Map([[filePath, snapshotId]])
    }

    this.checkpoints.set(checkpoint.id, checkpoint)

    // 清理过期检查点
    this.cleanup()

    return checkpoint
  }

  /**
   * 列出所有检查点（按时间倒序）
   */
  list(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 获取单个检查点
   */
  get(id: string): Checkpoint | null {
    return this.checkpoints.get(id) || null
  }

  /**
   * 手动创建检查点
   */
  createManual(name: string, description: string, fileSnapshots: Map<string, string>): Checkpoint {
    const checkpoint: Checkpoint = {
      id: randomUUID(),
      name,
      description,
      timestamp: Date.now(),
      fileSnapshots: new Map(fileSnapshots)
    }

    this.checkpoints.set(checkpoint.id, checkpoint)
    this.cleanup()

    return checkpoint
  }

  /**
   * 删除检查点
   */
  delete(id: string): boolean {
    return this.checkpoints.delete(id)
  }

  /**
   * 获取指定时间之后的快照 ID 映射
   */
  getSnapshotsSince(timestamp: number): Map<string, string> {
    const snapshots = new Map<string, string>()

    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.timestamp >= timestamp) {
        for (const [filePath, snapshotId] of checkpoint.fileSnapshots) {
          snapshots.set(filePath, snapshotId)
        }
      }
    }

    return snapshots
  }

  /**
   * 清理过期检查点
   */
  private cleanup(): void {
    const now = Date.now()

    // 删除过期检查点
    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (now - checkpoint.timestamp > this.maxAge) {
        this.checkpoints.delete(id)
      }
    }

    // 如果超过最大数量，删除最旧的
    if (this.checkpoints.size > this.maxCheckpoints) {
      const sorted = Array.from(this.checkpoints.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)

      const toDelete = sorted.slice(0, this.checkpoints.size - this.maxCheckpoints)
      for (const [id] of toDelete) {
        this.checkpoints.delete(id)
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add electron/checkpointManager.ts
git commit -m "feat: add CheckpointManager skeleton"
```

---

### Task 3: 集成 CheckpointManager 到 OperationExecutor

**Files:**
- Modify: `electron/operationExecutor.ts:44-51,172-224`

**Step 1: 添加 CheckpointManager 依赖**

修改构造函数：

```typescript
import type { CheckpointManager } from './checkpointManager.js'

export class OperationExecutor {
  // File snapshots stored by ID (the Map key serves as the snapshot ID)
  private snapshots: Map<string, FileSnapshot> = new Map()

  constructor(
    private getToolPermission: (tool: string) => ToolPermissionConfig | undefined,
    private checkpointManager: CheckpointManager
  ) {}
```

**Step 2: 修改 writeFile 方法以自动创建检查点**

在 `writeFile` 方法中，创建快照后创建检查点：

```typescript
async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
  try {
    // 获取权限配置
    const permission = this.getToolPermission('sandbox_write_file')

    if (!permission?.sandboxConstraints) {
      return { success: false, error: 'No sandbox constraints configured for file writing' }
    }

    // 验证路径
    if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths || [])) {
      return { success: false, error: `Access denied: path not in allowed sandbox` }
    }

    // 计算实际字节大小
    const actualSize = Buffer.byteLength(content, 'utf-8')

    // 检查文件大小限制
    const maxSize = permission.sandboxConstraints.maxFileSize || 10 * 1024 * 1024
    if (actualSize > maxSize) {
      return {
        success: false,
        error: `File too large: ${actualSize} bytes (max: ${maxSize} bytes)`
      }
    }

    // 创建快照
    const snapshotId = await this.createSnapshot(filePath)

    // 自动创建检查点
    const checkpoint = this.checkpointManager.createAuto(filePath, snapshotId)
    console.log(`[Checkpoint] Created: ${checkpoint.name} (${checkpoint.id})`)

    try {
      // 写入文件
      await fs.writeFile(filePath, content, 'utf-8')

      return {
        success: true,
        data: {
          bytesWritten: actualSize,
          snapshotId,
          checkpointId: checkpoint.id
        }
      }
    } catch (writeError) {
      // 写入失败，清理快照和检查点
      this.snapshots.delete(snapshotId)
      this.checkpointManager.delete(checkpoint.id)
      throw writeError
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to write file: ${(error as Error).message}`
    }
  }
}
```

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: integrate CheckpointManager into OperationExecutor"
```

---

### Task 4: 创建 RollbackEngine

**Files:**
- Create: `electron/rollbackEngine.ts`
- Test: None (主进程代码)

**Step 1: 创建 RollbackEngine 类**

```typescript
/**
 * RollbackEngine - 批量回滚引擎
 *
 * 支持回滚到指定检查点，仅回滚文件操作
 */

import * as fs from 'fs/promises'
import type { Checkpoint, FileSnapshot, RollbackResult, RollbackPreview } from '../src/types/operation.js'
import type { CheckpointManager } from './checkpointManager.js'

export class RollbackEngine {
  constructor(
    private checkpointManager: CheckpointManager,
    private snapshots: Map<string, FileSnapshot>
  ) {}

  /**
   * 回滚到指定检查点
   */
  async rollbackTo(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpointManager.get(checkpointId)

    if (!checkpoint) {
      return {
        success: false,
        error: `Checkpoint not found: ${checkpointId}`
      }
    }

    const results: Array<{ path: string; snapshotId: string; success: boolean }> = []

    // 按时间倒序回滚（避免依赖冲突）
    const entries = Array.from(checkpoint.fileSnapshots.entries())
      .sort(([, a], [, b]) => {
        const snapshotA = this.snapshots.get(a)
        const snapshotB = this.snapshots.get(b)
        return (snapshotB?.timestamp || 0) - (snapshotA?.timestamp || 0)
      })

    for (const [filePath, snapshotId] of entries) {
      const result = await this.rollbackFile(filePath, snapshotId)
      results.push(result)
    }

    const allSuccess = results.every(r => r.success)

    return {
      success: allSuccess,
      checkpointId,
      files: results
    }
  }

  /**
   * 回滚单个文件
   */
  async rollbackFile(filePath: string, snapshotId: string): Promise<RollbackResult> {
    const snapshot = this.snapshots.get(snapshotId)

    if (!snapshot) {
      return {
        success: false,
        error: `Snapshot not found: ${snapshotId}`
      }
    }

    try {
      if (snapshot.content === '') {
        // 文件原本不存在，删除它
        await fs.unlink(filePath)
      } else {
        // 恢复文件内容
        await fs.writeFile(filePath, snapshot.content, 'utf-8')
      }

      return {
        success: true,
        files: [{ path: filePath, snapshotId, success: true }]
      }
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${(error as Error).message}`,
        files: [{ path: filePath, snapshotId, success: false }]
      }
    }
  }

  /**
   * 预览回滚
   */
  previewRollback(checkpointId: string): RollbackPreview {
    const checkpoint = this.checkpointManager.get(checkpointId)

    if (!checkpoint) {
      return {
        files: [],
        canRollback: false,
        warnings: [`Checkpoint not found: ${checkpointId}`]
      }
    }

    const files: Array<{
      path: string
      currentSize: number
      oldSize: number
      willDelete: boolean
    }> = []
    const warnings: string[] = []

    for (const [filePath, snapshotId] of checkpoint.fileSnapshots) {
      const snapshot = this.snapshots.get(snapshotId)

      if (!snapshot) {
        warnings.push(`Snapshot not found for ${filePath}`)
        continue
      }

      files.push({
        path: filePath,
        currentSize: snapshot.size,
        oldSize: snapshot.size,
        willDelete: snapshot.content === ''
      })
    }

    return {
      files,
      canRollback: warnings.length === 0,
      warnings
    }
  }
}
```

**Step 2: Commit**

```bash
git add electron/rollbackEngine.ts
git commit -m "feat: add RollbackEngine for batch rollback"
```

---

### Task 5: 创建 LogExporter

**Files:**
- Create: `electron/logExporter.ts`
- Test: None (主进程代码)

**Step 1: 创建 LogExporter 类**

```typescript
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
      filtered = filtered.filter(log =>
        log.timestamp >= options.timeRange!.start &&
        log.timestamp <= options.timeRange!.end
      )
    }

    // 工具过滤
    if (options.toolFilter && options.toolFilter.length > 0) {
      filtered = filtered.filter(log =>
        log.tool && options.toolFilter!.includes(log.tool)
      )
    }

    // 状态过滤
    if (options.statusFilter && options.statusFilter.length > 0) {
      filtered = filtered.filter(log =>
        options.statusFilter!.includes(log.status)
      )
    }

    return filtered
  }

  /**
   * 导出为 JSON
   */
  private exportJSON(logs: LogEntry[]): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      totalOperations: logs.length,
      operations: logs
    }, null, 2)
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
      .map(row => row.map(cell => `"${cell}"`).join(','))

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
      successRate: 0
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
        lines.push(JSON.stringify(log.details, null, 2))
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
```

**Step 2: Commit**

```bash
git add electron/logExporter.ts
git commit -m "feat: add LogExporter with JSON/CSV/Markdown formats"
```

---

### Task 6: 注册新组件到 main.ts

**Files:**
- Modify: `electron/main.ts:1-50` (imports)
- Modify: `electron/main.ts:3500-3600` (registration area)

**Step 1: 添加导入**

在文件顶部的导入区域添加：

```typescript
import { CheckpointManager } from './checkpointManager.js'
import { RollbackEngine } from './rollbackEngine.js'
import { LogExporter } from './logExporter.js'
```

**Step 2: 初始化组件**

在 main.ts 的初始化区域（在 `getOperationLogger` 调用附近）添加：

```typescript
// 初始化 CheckpointManager
const checkpointManager = new CheckpointManager(50, 7)

// 更新 OperationExecutor 以使用 CheckpointManager
// 需要找到 operationExecutor 的创建位置并更新
```

**注意**: 需要找到现有的 `operationExecutor` 初始化代码并更新构造函数调用。

**Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: register CheckpointManager, RollbackEngine, LogExporter"
```

---

### Task 7: 添加 IPC 处理器

**Files:**
- Modify: `electron/main.ts` (在现有 IPC handlers 区域)

**Step 1: 添加检查点 IPC 处理器**

```typescript
// 列出所有检查点
ipcMain.handle('checkpoint-list', async () => {
  try {
    const checkpoints = checkpointManager.list()
    // 转换 Map 为普通对象以便序列化
    return checkpoints.map(cp => ({
      ...cp,
      fileSnapshots: Array.from(cp.fileSnapshots.entries())
    }))
  } catch (error) {
    console.error('[Checkpoint] List error:', error)
    return []
  }
})

// 获取单个检查点
ipcMain.handle('checkpoint-get', async (_event, id: string) => {
  try {
    const checkpoint = checkpointManager.get(id)
    if (!checkpoint) return null
    return {
      ...checkpoint,
      fileSnapshots: Array.from(checkpoint.fileSnapshots.entries())
    }
  } catch (error) {
    console.error('[Checkpoint] Get error:', error)
    return null
  }
})

// 手动创建检查点
ipcMain.handle('checkpoint-create', async (_event, name: string, description: string) => {
  try {
    const checkpoint = checkpointManager.createManual(name, description, new Map())
    return {
      ...checkpoint,
      fileSnapshots: Array.from(checkpoint.fileSnapshots.entries())
    }
  } catch (error) {
    console.error('[Checkpoint] Create error:', error)
    return null
  }
})
```

**Step 2: 添加回滚 IPC 处理器**

```typescript
// 预览回滚
ipcMain.handle('rollback-preview', async (_event, checkpointId: string) => {
  try {
    const preview = rollbackEngine.previewRollback(checkpointId)
    return preview
  } catch (error) {
    console.error('[Rollback] Preview error:', error)
    return { files: [], canRollback: false, warnings: ['Preview failed'] }
  }
})

// 执行回滚
ipcMain.handle('rollback-execute', async (_event, checkpointId: string) => {
  try {
    const result = await rollbackEngine.rollbackTo(checkpointId)

    // 记录回滚操作
    operationLogger.logSystem(
      `Rollback to checkpoint ${checkpointId}: ${result.files?.length || 0} files affected`,
      result.success ? 'success' : 'error'
    )

    return result
  } catch (error) {
    console.error('[Rollback] Execute error:', error)
    return { success: false, error: (error as Error).message }
  }
})
```

**Step 3: 添加导出日志 IPC 处理器**

```typescript
// 导出日志（新版本，支持 CSV 和 Markdown）
ipcMain.handle('export-logs-v2', async (_event, options: { format: 'json' | 'csv' | 'markdown', timeRange?: { start: number; end: number } }) => {
  try {
    const logs = operationLogger.getLogs()
    const exporter = new LogExporter()
    const content = exporter.export(logs, options)
    return content
  } catch (error) {
    console.error('[Export] Error:', error)
    throw error
  }
})
```

**Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add IPC handlers for checkpoint, rollback, export"
```

---

### Task 8: 更新 preload.js 暴露新 API

**Files:**
- Modify: `electron/preload.js`

**Step 1: 在 preload.js 的 api 对象中添加新方法**

```javascript
// 检查点相关
checkpointList: () => ipcRenderer.invoke('checkpoint-list'),
checkpointGet: (id) => ipcRenderer.invoke('checkpoint-get', id),
checkpointCreate: (name, description) => ipcRenderer.invoke('checkpoint-create', name, description),

// 回滚相关
rollbackPreview: (checkpointId) => ipcRenderer.invoke('rollback-preview', checkpointId),
rollbackExecute: (checkpointId) => ipcRenderer.invoke('rollback-execute', checkpointId),

// 导出日志（新版本）
exportLogsV2: (options) => ipcRenderer.invoke('export-logs-v2', options),
```

**Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: expose checkpoint, rollback, export APIs in preload"
```

---

### Task 9: 更新 TypeScript 类型定义

**Files:**
- Modify: `src/types/index.ts:192-233` (ElectronAPI interface)

**Step 1: 添加新 API 方法到 ElectronAPI 接口**

```typescript
export interface ElectronAPI {
  // ... 现有方法 ...

  /** ==================== 检查点管理 ==================== */

  /** 列出所有检查点 */
  checkpointList: () => Promise<Array<{
    id: string
    name: string
    description: string
    timestamp: number
    fileSnapshots: Array<[string, string]>
  }>>

  /** 获取单个检查点 */
  checkpointGet: (id: string) => Promise<{
    id: string
    name: string
    description: string
    timestamp: number
    fileSnapshots: Array<[string, string]>
  } | null>

  /** 手动创建检查点 */
  checkpointCreate: (name: string, description: string) => Promise<{
    id: string
    name: string
    description: string
    timestamp: number
    fileSnapshots: Array<[string, string]>
  } | null>

  /** ==================== 回滚引擎 ==================== */

  /** 预览回滚 */
  rollbackPreview: (checkpointId: string) => Promise<import('./operation').RollbackPreview>

  /** 执行回滚 */
  rollbackExecute: (checkpointId: string) => Promise<import('./operation').RollbackResult>

  /** ==================== 日志导出 ==================== */

  /** 导出日志（支持 CSV 和 Markdown） */
  exportLogsV2: (options: {
    format: 'json' | 'csv' | 'markdown'
    timeRange?: { start: number; end: number }
  }) => Promise<{ success: boolean; content?: string; error?: string }>
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add checkpoint, rollback, export to ElectronAPI types"
```

---

### Task 10: 更新 ipc.ts 封装

**Files:**
- Modify: `src/lib/ipc.ts`

**Step 1: 在 ipc 对象中添加新方法**

在文件末尾的 `platform:` 属性之前添加：

```typescript
  // ==================== 检查点管理 ====================

  /**
   * 列出所有检查点
   */
  checkpointList: async () => {
    if (window.electronAPI?.checkpointList) {
      return window.electronAPI.checkpointList()
    }
    console.warn('electronAPI.checkpointList not available')
    return []
  },

  /**
   * 获取单个检查点
   */
  checkpointGet: async (id: string) => {
    if (window.electronAPI?.checkpointGet) {
      return window.electronAPI.checkpointGet(id)
    }
    console.warn('electronAPI.checkpointGet not available')
    return null
  },

  /**
   * 手动创建检查点
   */
  checkpointCreate: async (name: string, description: string) => {
    if (window.electronAPI?.checkpointCreate) {
      return window.electronAPI.checkpointCreate(name, description)
    }
    console.warn('electronAPI.checkpointCreate not available')
    return null
  },

  // ==================== 回滚引擎 ====================

  /**
   * 预览回滚
   */
  rollbackPreview: async (checkpointId: string) => {
    if (window.electronAPI?.rollbackPreview) {
      return window.electronAPI.rollbackPreview(checkpointId)
    }
    console.warn('electronAPI.rollbackPreview not available')
    return { files: [], canRollback: false, warnings: ['API not available'] }
  },

  /**
   * 执行回滚
   */
  rollbackExecute: async (checkpointId: string) => {
    if (window.electronAPI?.rollbackExecute) {
      return window.electronAPI.rollbackExecute(checkpointId)
    }
    console.warn('electronAPI.rollbackExecute not available')
    return { success: false, error: 'API not available' }
  },

  // ==================== 日志导出 ====================

  /**
   * 导出日志（支持 CSV 和 Markdown）
   */
  exportLogsV2: async (options: { format: 'json' | 'csv' | 'markdown', timeRange?: { start: number; end: number } }) => {
    if (window.electronAPI?.exportLogsV2) {
      return window.electronAPI.exportLogsV2(options)
    }
    console.warn('electronAPI.exportLogsV2 not available')
    return { success: false, error: 'API not available', content: '' }
  },
```

**Step 2: Commit**

```bash
git add src/lib/ipc.ts
git commit -m "feat: add checkpoint, rollback, export to ipc wrapper"
```

---

### Task 11: 创建 TimelinePanel 组件

**Files:**
- Create: `src/components/ui/TimelinePanel.tsx`
- Test: None (UI 组件)

**Step 1: 创建 TimelinePanel 组件**

```typescript
/**
 * TimelinePanel - 时间线面板组件
 *
 * 可折叠侧边面板，显示操作历史时间线
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, Hourglass, ChevronDown, ChevronRight } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import type { LogEntry } from '../../types/operation'

interface TimelinePanelProps {
  className?: string
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({ className = '' }) => {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
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

  // 计算统计信息
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    entries.forEach(entry => {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1
    })
    return {
      total: entries.length,
      byStatus
    }
  }, [entries])

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      pending: <Hourglass size={14} className="text-yellow-400" />,
      approved: <CheckCircle size={14} className="text-blue-400" />,
      denied: <XCircle size={14} className="text-red-400" />,
      success: <CheckCircle size={14} className="text-green-400" />,
      error: <XCircle size={14} className="text-red-400" />,
      completed: <CheckCircle size={14} className="text-green-400" />,
      awaiting_approval: <AlertCircle size={14} className="text-orange-400" />,
      running: <Clock size={14} className="text-blue-400 animate-pulse" />
    }
    return iconMap[status] || <Clock size={14} />
  }

  // 生成参数摘要
  const summarizeParams = (details: unknown): string => {
    if (!details || typeof details !== 'object') return ''
    const obj = details as Record<string, unknown>
    const parts: string[] = []

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'content') {
        const str = String(value)
        parts.push(`${key}: ${str.length > 30 ? str.slice(0, 30) + '...' : str}`)
      } else {
        const str = JSON.stringify(value)
        parts.push(`${key}: ${str.length > 30 ? str.slice(0, 30) + '...' : str}`)
      }
      if (parts.join(', ').length > 80) break
    }

    return parts.join(', ')
  }

  return (
    <div className={`timeline-panel ${isCollapsed ? 'collapsed' : ''} ${className}`}>
      {/* 头部 */}
      <div className="timeline-header">
        <div className="timeline-title">
          <Clock size={16} />
          <span>时间线</span>
          <span className="timeline-count">{stats.total}</span>
        </div>
        <button
          className="timeline-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? '展开' : '折叠'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* 内容区域 */}
      {!isCollapsed && (
        <>
          {/* 过滤器 */}
          <div className="timeline-filters">
            <select
              value={filter.status?.[0] || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">全部状态</option>
              <option value="success">成功</option>
              <option value="error">失败</option>
              <option value="pending">等待中</option>
            </select>
          </div>

          {/* 时间线列表 */}
          <div className="timeline-list">
            {entries.map((entry) => (
              <div key={entry.id} className={`timeline-item status-${entry.status}`}>
                <div className="timeline-item-time">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div className="timeline-item-icon">
                  {getStatusIcon(entry.status)}
                </div>
                <div className="timeline-item-content">
                  <div className="timeline-item-tool">{entry.tool || 'System'}</div>
                  <div className="timeline-item-message">{entry.title}</div>
                  {entry.details && (
                    <div className="timeline-item-details">
                      {summarizeParams(entry.details)}
                    </div>
                  )}
                  {entry.duration && (
                    <div className="timeline-item-duration">{entry.duration}ms</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TimelinePanel
```

**Step 2: Commit**

```bash
git add src/components/ui/TimelinePanel.tsx
git commit -m "feat: add TimelinePanel component"
```

---

### Task 12: 创建 TimelinePanel 样式

**Files:**
- Create: `src/components/ui/TimelinePanel.css`

**Step 1: 创建样式文件**

```css
/**
 * TimelinePanel 样式
 */

.timeline-panel {
  width: 320px;
  background: var(--background-secondary, #1e1e1e);
  border-left: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.timeline-panel.collapsed {
  width: 40px;
}

/* 头部 */
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-color, #333);
}

.timeline-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.timeline-count {
  background: var(--accent-color, #007acc);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.timeline-collapse-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-collapse-btn:hover {
  background: var(--hover-background, #333);
  color: var(--text-primary, #fff);
}

/* 过滤器 */
.timeline-filters {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #333);
}

.timeline-filters select {
  width: 100%;
  padding: 6px 8px;
  background: var(--input-background, #2d2d2d);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 12px;
}

.timeline-filters select:focus {
  outline: none;
  border-color: var(--accent-color, #007acc);
}

/* 时间线列表 */
.timeline-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.timeline-list::-webkit-scrollbar {
  width: 6px;
}

.timeline-list::-webkit-scrollbar-track {
  background: transparent;
}

.timeline-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #444);
  border-radius: 3px;
}

/* 时间线条目 */
.timeline-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
  transition: background 0.15s ease;
}

.timeline-item:hover {
  background: var(--hover-background, #2a2a2a);
}

/* 状态样式 */
.timeline-item.status-success {
  border-left-color: #4ade80;
}

.timeline-item.status-error,
.timeline-item.status-denied {
  border-left-color: #f87171;
}

.timeline-item.status-pending,
.timeline-item.status-awaiting_approval {
  border-left-color: #fbbf24;
}

.timeline-item.status-running {
  border-left-color: #60a5fa;
}

.timeline-item-time {
  font-size: 10px;
  color: var(--text-secondary, #999);
  min-width: 50px;
  text-align: right;
}

.timeline-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
}

.timeline-item-content {
  flex: 1;
  min-width: 0;
}

.timeline-item-tool {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin-bottom: 2px;
}

.timeline-item-message {
  font-size: 11px;
  color: var(--text-secondary, #bbb);
  line-height: 1.4;
}

.timeline-item-details {
  font-size: 10px;
  color: var(--text-muted, #888);
  margin-top: 2px;
  word-break: break-all;
}

.timeline-item-duration {
  font-size: 10px;
  color: var(--accent-color, #60a5fa);
  margin-top: 2px;
}

/* 折叠状态 */
.timeline-panel.collapsed .timeline-title span:not(.timeline-count) {
  display: none;
}

.timeline-panel.collapsed .timeline-filters,
.timeline-panel.collapsed .timeline-list {
  display: none;
}
```

**Step 2: 在 index.css 中导入样式**

在 `src/index.css` 中添加：

```css
@import './components/ui/TimelinePanel.css';
```

**Step 3: Commit**

```bash
git add src/components/ui/TimelinePanel.css src/index.css
git commit -m "feat: add TimelinePanel styles"
```

---

### Task 13: 集成 TimelinePanel 到 ConversationPage

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 导入并添加 TimelinePanel**

在 ConversationPage.tsx 的导入区域添加：

```typescript
import TimelinePanel from '../components/ui/TimelinePanel'
```

在返回的 JSX 中，找到主布局容器，在合适位置添加时间线面板。通常是在消息列表旁边：

```tsx
// 在主布局中添加时间线面板
<div className="conversation-layout">
  {/* 现有的消息列表等内容 */}

  {/* 时间线面板 */}
  <TimelinePanel className="timeline-sidebar" />
</div>
```

**Step 2: 添加布局样式**

在 ConversationPage 的样式或全局样式中添加：

```css
.conversation-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 0;
  height: 100%;
}

.timeline-sidebar {
  grid-column: 2;
  grid-row: 1;
}

/* 当时间线折叠时，调整布局 */
.timeline-sidebar.collapsed + .main-content {
  grid-column: 2;
}
```

**Step 3: Commit**

```bash
git add src/pages/ConversationPage.tsx src/index.css
git commit -m "feat: integrate TimelinePanel into ConversationPage"
```

---

### Task 14: 运行 TypeScript 检查

**Files:**
- None (验证步骤)

**Step 1: 运行 TypeScript 编译检查**

```bash
npm run build
```

**预期结果**: 编译成功，无类型错误

**Step 2: 如果有类型错误，修复并重新检查**

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: resolve TypeScript type errors"
```

---

### Task 15: 测试端到端流程

**Files:**
- None (测试步骤)

**Step 1: 启动应用**

```bash
npm run electron:dev
```

**Step 2: 手动测试清单**

1. **检查点自动创建**:
   - 执行文件写入操作
   - 调用 `ipc.checkpointList()` 检查是否自动创建检查点
   - 验证检查点名称格式正确

2. **回滚预览和执行**:
   - 选择一个检查点
   - 调用 `ipc.rollbackPreview(checkpointId)`
   - 确认预览信息正确
   - 调用 `ipc.rollbackExecute(checkpointId)`
   - 验证文件已回滚

3. **日志导出**:
   - 调用 `ipc.exportLogsV2({ format: 'json' })`
   - 调用 `ipc.exportLogsV2({ format: 'csv' })`
   - 调用 `ipc.exportLogsV2({ format: 'markdown' })`
   - 验证输出格式正确

4. **时间线 UI**:
   - 打开对话页面
   - 验证时间线面板显示
   - 测试折叠/展开
   - 测试过滤器
   - 验证实时更新

**Step 3: 修复发现的问题**

**Step 4: 最终 Commit**

```bash
git add -A
git commit -m "fix: address testing issues and finalize Phase 5"
```

---

## 验收标准

- [ ] 每次文件写入自动创建检查点
- [ ] 可以列出所有检查点
- [ ] 可以预览回滚影响
- [ ] 可以回滚到指定检查点
- [ ] 日志可以导出为 JSON/CSV/Markdown
- [ ] 时间线面板正确显示操作历史
- [ ] 时间线支持折叠/展开
- [ ] 时间线支持状态过滤
- [ ] 所有 UI 使用中文
- [ ] TypeScript 编译无错误

---

## 总计

- **15 个任务**
- **新建文件**: 5 个
  - `electron/checkpointManager.ts`
  - `electron/rollbackEngine.ts`
  - `electron/logExporter.ts`
  - `src/components/ui/TimelinePanel.tsx`
  - `src/components/ui/TimelinePanel.css`
- **修改文件**: 6 个
  - `src/types/operation.ts`
  - `electron/operationExecutor.ts`
  - `electron/main.ts`
  - `electron/preload.js`
  - `src/types/index.ts`
  - `src/lib/ipc.ts`
  - `src/pages/ConversationPage.tsx`
  - `src/index.css`
