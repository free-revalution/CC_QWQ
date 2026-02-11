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
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 写入文件（支持回滚）
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 回滚文件到指定快照
   */
  async rollback(snapshotId: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
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
   * 创建文件快照
   */
  private async createSnapshot(filePath: string): Promise<FileSnapshot> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }
}
