/**
 * ToolCallManager - 工具调用状态管理器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 负责跟踪 Claude Code 工具调用的完整生命周期：
 * pending → running → completed/error
 */

import type {
  ToolCall,
  ToolCallState,
  ToolPermission
} from '../types/message'
import type { ClaudeToolType } from '../types'

/**
 * 工具调用管理器
 */
export class ToolCallManager {
  private calls: Map<string, ToolCall> = new Map()

  /**
   * 创建新的工具调用
   */
  create(id: string, name: ClaudeToolType, input: Record<string, unknown>): ToolCall {
    const call: ToolCall = {
      name,
      input,
      state: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      description: this.extractDescription(name, input)
    }
    this.calls.set(id, call)
    return call
  }

  /**
   * 更新工具调用状态
   */
  updateState(id: string, state: ToolCallState, result?: unknown): void {
    const call = this.calls.get(id)
    if (call) {
      call.state = state
      if (state === 'running') {
        call.startedAt = Date.now()
      }
      if (state === 'completed' || state === 'error') {
        call.completedAt = Date.now()
        call.result = result
      }
    }
  }

  /**
   * 设置权限信息
   */
  setPermission(id: string, permission: ToolPermission): void {
    const call = this.calls.get(id)
    if (call) {
      call.permission = permission
    }
  }

  /**
   * 获取工具调用
   */
  get(id: string): ToolCall | undefined {
    return this.calls.get(id)
  }

  /**
   * 获取所有工具调用
   */
  getAll(): ToolCall[] {
    return Array.from(this.calls.values())
  }

  /**
   * 获取指定状态的工具调用
   */
  getByState(state: ToolCallState): ToolCall[] {
    return this.getAll().filter(call => call.state === state)
  }

  /**
   * 获取运行中的工具调用
   */
  getRunning(): ToolCall[] {
    return this.getByState('running')
  }

  /**
   * 获取待处理的工具调用（包括 pending 和等待权限的）
   */
  getPending(): ToolCall[] {
    return this.getAll().filter(call =>
      call.state === 'pending' ||
      (call.state === 'running' && call.permission?.status === 'pending')
    )
  }

  /**
   * 移除工具调用
   */
  remove(id: string): boolean {
    return this.calls.delete(id)
  }

  /**
   * 清空所有工具调用
   */
  clear(): void {
    this.calls.clear()
  }

  /**
   * 提取可读描述
   */
  private extractDescription(name: ClaudeToolType, input: Record<string, unknown>): string | null {
    try {
      switch (name) {
        case 'Read':
          return input?.filePath || input?.path
            ? `读取 ${input.filePath || input.path}`
            : null

        case 'Write':
          return input?.filePath || input?.path
            ? `写入 ${input.filePath || input.path}`
            : null

        case 'Edit':
          return input?.filePath || input?.path
            ? `编辑 ${input.filePath || input.path}`
            : null

        case 'Bash':
          return typeof input?.command === 'string'
            ? `执行: ${input.command.split(' ')[0]}`
            : null

        case 'Glob':
          return input?.pattern
            ? `搜索文件: ${input.pattern}`
            : null

        case 'Grep':
          return input?.pattern
            ? `搜索内容: ${input.pattern}`
            : null

        case 'WebFetch':
          return input?.url
            ? `请求: ${input.url}`
            : null

        case 'NotebookEdit':
          return input?.path
            ? `编辑 Notebook: ${input.path}`
            : null

        case 'Task':
          return typeof input?.prompt === 'string'
            ? `启动子任务: ${input.prompt.slice(0, 30)}...`
            : null

        case 'AskUserQuestion':
          return input?.question
            ? `询问: ${input.question}`
            : null

        case 'Skill':
          return input?.skill
            ? `调用技能: ${input.skill}`
            : null

        default:
          return null
      }
    } catch {
      return null
    }
  }
}

/**
 * 全局单例
 */
export const toolCallManager = new ToolCallManager()
