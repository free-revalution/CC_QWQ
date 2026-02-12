/**
 * Operation Executor - 操作执行器
 *
 * 执行实际的文件和命令操作，带沙盒限制和快照支持
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import type { ToolPermissionConfig, FileSnapshot } from '../src/types/operation.js'
import type { CheckpointManager } from './checkpointManager.js'

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert glob pattern to RegExp
 * Safely escapes user input before converting glob syntax
 */
function globToRegex(pattern: string): RegExp {
  // First escape all regex special chars, then convert glob syntax
  const escaped = escapeRegExp(pattern)
  const regex = escaped
    .replace(/\\\*\\\*/g, '.*')  // ** -> .*
    .replace(/\\\*/g, '[^/]*')    // *  -> [^/]*
    .replace(/\\\?/g, '[^/]')     // ?  -> [^/]
  return new RegExp(`^${regex}$`)
}

function matchesPattern(value: string, pattern: string): boolean {
  return globToRegex(pattern).test(value)
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.startsWith('!')) {
      return !globToRegex(pattern.substring(1)).test(value)
    }
    return matchesPattern(value, pattern)
  })
}

// 执行结果
interface ExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  snapshotId?: string
}

export class OperationExecutor {
  // File snapshots stored by ID (the Map key serves as the snapshot ID)
  private snapshots: Map<string, FileSnapshot> = new Map()

  constructor(
    private getToolPermission: (tool: string) => ToolPermissionConfig | undefined,
    private checkpointManager: CheckpointManager
  ) {}

  /**
   * 获取快照映射的公共方法
   * Returns a copy to prevent external modification
   */
  getSnapshots(): Map<string, FileSnapshot> {
    return new Map(this.snapshots)
  }

  /**
   * 读取文件（沙盒限制）
   */
  async readFile(filePath: string): Promise<ExecutionResult> {
    try {
      // 获取权限配置
      const permission = this.getToolPermission('sandbox_read_file')

      if (!permission?.sandboxConstraints?.allowedPaths) {
        return { success: false, error: 'No sandbox constraints configured for file reading' }
      }

      // 验证路径
      if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths || [])) {
        return { success: false, error: `Access denied: path not in allowed sandbox` }
      }

      // 读取文件
      const content = await fs.readFile(filePath, 'utf-8')

      return {
        success: true,
        data: { content }
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` }
      } else if (err.code === 'EACCES') {
        return { success: false, error: `Permission denied: ${filePath}` }
      }
      return { success: false, error: `Failed to read file: ${err.message}` }
    }
  }

  /**
   * 执行系统命令
   */
  async executeCommand(command: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        // 获取权限配置
        const permission = this.getToolPermission('system_exec')

        if (!permission) {
          resolve({ success: false, error: 'Command execution not configured' })
          return
        }

        // 增强的命令注入检查
        // 危险字符和模式：shell 控制操作符、命令替换、重定向等
        const dangerousPatterns = [
          /[;&|`$]/,           // Shell 控制字符
          /\$\(/,              // 命令替换 $(...)
          /\${/,               // 变量展开 ${...}
          /\(\)/,              // 子 shell
          /[<>]/,              // 重定向
          /\\/,                // 转义字符
          /\n|\r/,             // 换行符
          /\.\./,              // 路径遍历
        ]

        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            resolve({ success: false, error: `Command contains dangerous pattern: ${pattern.source}` })
            return
          }
        }

        // 解析命令
        const parts = command.trim().split(/\s+/)
        const cmd = parts[0]
        const args = parts.slice(1)

        // 可选：命令白名单检查（如果有配置）
        const allowedCommands = permission.sandboxConstraints?.allowedCommands as string[] | undefined
        if (allowedCommands && allowedCommands.length > 0) {
          if (!allowedCommands.includes(cmd)) {
            resolve({ success: false, error: `Command not allowed: ${cmd}` })
            return
          }
        }

        // 执行命令（不使用 shell，更安全）
        const proc = spawn(cmd, args, {
          cwd: process.cwd(),
          env: { ...process.env, PATH: process.env.PATH },
          shell: false  // 不通过 shell 执行，避免注入
        })

        let stdout = ''
        let stderr = ''
        let resolved = false

        proc.stdout?.on('data', (data) => {
          stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        // 超时控制（60秒）
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            proc.kill()
            resolve({
              success: false,
              error: 'Command timed out after 60 seconds'
            })
          }
        }, 60000)

        proc.on('close', (code) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve({
              success: code === 0,
              data: {
                exitCode: code,
                stdout: stdout.trim(),
                stderr: stderr.trim()
              }
            })
          }
        })

        proc.on('error', (error) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve({
              success: false,
              error: `Failed to execute command: ${error.message}`
            })
          }
        })
      } catch (error) {
        resolve({
          success: false,
          error: `Command execution error: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    })
  }

  /**
   * 写入文件（支持回滚）
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    // 声明 checkpoint 变量，以便在 catch 块中访问
    let checkpoint: ReturnType<CheckpointManager['createAuto']> | undefined

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
      checkpoint = this.checkpointManager.createAuto(filePath, snapshotId)

      try {
        // 写入文件
        await fs.writeFile(filePath, content, 'utf-8')

        return {
          success: true,
          data: {
            bytesWritten: actualSize,
            snapshotId
          }
        }
      } catch (writeError) {
        // 写入失败，清理快照和检查点
        this.snapshots.delete(snapshotId)
        if (checkpoint) {
          this.checkpointManager.delete(checkpoint.id)
        }
        throw writeError
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${(error as Error).message}`
      }
    }
  }

  /**
   * 回滚文件到指定快照
   */
  async rollback(snapshotId: string): Promise<ExecutionResult> {
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
        await fs.unlink(snapshot.path)
      } else {
        // 恢复文件内容
        await fs.writeFile(snapshot.path, snapshot.content, 'utf-8')
      }

      // 从内存中移除快照
      this.snapshots.delete(snapshotId)

      return {
        success: true,
        data: {
          rolledBackTo: snapshotId,
          filePath: snapshot.path
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${(error as Error).message}`
      }
    }
  }

  /**
   * 验证路径是否在沙盒允许范围内
   * 使用 path.resolve 防止路径遍历攻击
   */
  private validatePath(filePath: string, allowedPaths: string[]): boolean {
    try {
      // 解析为绝对路径，防止 ../ 等路径遍历
      const resolvedPath = path.resolve(filePath)

      // 检查是否匹配任何允许的模式
      // 首先检查是否在允许的目录内
      for (const allowedPath of allowedPaths) {
        // 对于 glob 模式，使用模式匹配
        if (allowedPath.includes('*') || allowedPath.includes('?')) {
          if (matchesAnyPattern(resolvedPath, allowedPaths)) {
            return true
          }
        } else {
          // 对于具体路径，检查是否以允许路径开头
          const resolvedAllowed = path.resolve(allowedPath)
          // 确保路径以分隔符结尾，防止 /allowed 匹配 /allowed-other
          const allowedWithSep = resolvedAllowed.endsWith(path.sep)
            ? resolvedAllowed
            : resolvedAllowed + path.sep

          // 检查是否是允许目录本身或其子路径
          if (resolvedPath === resolvedAllowed || resolvedPath.startsWith(allowedWithSep)) {
            return true
          }
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * 创建文件快照并存储，返回快照ID
   */
  private async createSnapshot(filePath: string): Promise<string> {
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const timestamp = Date.now()

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const hash = createHash('sha256').update(content).digest('hex')

      const snapshot: FileSnapshot = {
        type: 'file',
        path: filePath,
        content,
        hash,
        timestamp,
        size: content.length
      }

      // 存储快照到内存
      this.snapshots.set(snapshotId, snapshot)
      return snapshotId
    } catch {
      // 文件不存在或无法读取，存储空快照
      const snapshot: FileSnapshot = {
        type: 'file',
        path: filePath,
        content: '',
        hash: '',
        timestamp,
        size: 0
      }

      // 存储快照到内存
      this.snapshots.set(snapshotId, snapshot)
      return snapshotId
    }
  }
}
