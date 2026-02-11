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

/**
 * Convert glob pattern to RegExp
 */
function globToRegex(pattern: string): RegExp {
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(regex)
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
  data?: any
  error?: string
  snapshotId?: string
}

export class OperationExecutor {
  // File snapshots stored by ID (the Map key serves as the snapshot ID)
  private snapshots: Map<string, FileSnapshot> = new Map()

  constructor(
    private getToolPermission: (tool: string) => ToolPermissionConfig | undefined
  ) {}

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
      if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths)) {
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

        // 简单的命令注入检查
        const dangerousChars = [';', '|', '&', '`', '$', '(', ')', '\n', '\r']
        const hasDangerousChar = dangerousChars.some(char => command.includes(char))

        if (hasDangerousChar) {
          resolve({ success: false, error: 'Command contains dangerous characters' })
          return
        }

        // 解析命令
        const parts = command.trim().split(/\s+/)
        const cmd = parts[0]
        const args = parts.slice(1)

        // 执行命令
        const proc = spawn(cmd, args, {
          cwd: process.cwd(),
          env: { ...process.env, PATH: process.env.PATH }
        })

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (data) => {
          stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        // 超时控制（60秒）
        const timeout = setTimeout(() => {
          proc.kill()
          resolve({
            success: false,
            error: 'Command timed out after 60 seconds'
          })
        }, 60000)

        proc.on('close', (code) => {
          clearTimeout(timeout)
          resolve({
            success: code === 0,
            data: {
              exitCode: code,
              stdout: stdout.trim(),
              stderr: stderr.trim()
            }
          })
        })

        proc.on('error', (error) => {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: `Failed to execute command: ${error.message}`
          })
        })
      } catch (error) {
        resolve({
          success: false,
          error: `Command execution error: ${(error as Error).message}`
        })
      }
    })
  }

  /**
   * 写入文件（支持回滚）
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    try {
      // 获取权限配置
      const permission = this.getToolPermission('sandbox_write_file')

      if (!permission?.sandboxConstraints) {
        return { success: false, error: 'No sandbox constraints configured for file writing' }
      }

      // 验证路径
      if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths)) {
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
        // 写入失败，清理快照
        this.snapshots.delete(snapshotId)
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
   */
  private validatePath(filePath: string, allowedPaths: string[]): boolean {
    // 规范化路径
    const normalizedPath = path.normalize(filePath)

    // 检查是否匹配任何允许的模式
    return matchesAnyPattern(normalizedPath, allowedPaths)
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
    } catch (error) {
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
