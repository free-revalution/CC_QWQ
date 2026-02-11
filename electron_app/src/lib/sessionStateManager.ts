/**
 * SessionStateManager - 会话状态管理器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 负责管理会话的实时状态，包括：
 * - Claude 状态 (not_started / initializing / ready)
 * - 控制权 (desktop vs mobile)
 * - 思考状态 (thinking)
 * - 活跃时间 (activeAt)
 */

import type { SessionState, ActivityUpdate, ToolCall } from '../types/message'
import { ActivityAccumulator } from './activityAccumulator'

/**
 * WebSocket 客户端接口
 */
export interface WebSocketClient {
  readyState: number
  send: (data: string) => void
}

/**
 * 会话状态管理器选项
 */
export interface SessionStateManagerOptions {
  activityFlushInterval?: number  // 活动状态刷新间隔（毫秒）
}

/**
 * 会话状态管理器
 */
export class SessionStateManager {
  private states: Map<string, SessionState> = new Map()
  private activityAccumulator: ActivityAccumulator
  private mobileClients: Set<WebSocketClient>

  constructor(
    mobileClients: Set<WebSocketClient>,
    options: SessionStateManagerOptions = {}
  ) {
    this.mobileClients = mobileClients
    this.activityAccumulator = new ActivityAccumulator(
      (updates) => this.broadcastActivityUpdates(updates),
      { flushInterval: options.activityFlushInterval ?? 2000 }
    )
  }

  /**
   * 获取或创建会话状态
   */
  getOrCreate(sessionId: string): SessionState {
    if (!this.states.has(sessionId)) {
      this.states.set(sessionId, {
        sessionId,
        claudeStatus: 'not_started',
        controlledByUser: true,
        activeToolCalls: new Map(),
        lastActivity: Date.now(),
        thinking: false,
        thinkingAt: 0,
        activeAt: Date.now()
      })
    }
    return this.states.get(sessionId)!
  }

  /**
   * 获取会话状态
   */
  get(sessionId: string): SessionState | undefined {
    return this.states.get(sessionId)
  }

  /**
   * 获取所有会话状态
   */
  getAll(): SessionState[] {
    return Array.from(this.states.values())
  }

  /**
   * 获取活跃的会话（最近 5 分钟有活动）
   */
  getActive(): SessionState[] {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return this.getAll().filter(state => state.activeAt > fiveMinutesAgo)
  }

  /**
   * 获取正在思考的会话
   */
  getThinking(): SessionState[] {
    return this.getAll().filter(state => state.thinking)
  }

  /**
   * 更新会话状态
   */
  update(sessionId: string, updates: Partial<SessionState>): void {
    const state = this.getOrCreate(sessionId)

    // 应用更新
    Object.assign(state, updates)

    // 更新活跃时间
    if (updates.claudeStatus || updates.thinking !== undefined) {
      state.activeAt = Date.now()
    }

    // 广播活动状态
    this.activityAccumulator.addUpdate(sessionId, {
      active: true,
      activeAt: state.activeAt,
      thinking: state.thinking,
      thinkingAt: state.thinking ? state.thinkingAt : undefined
    })
  }

  /**
   * 设置 Claude 状态
   */
  setClaudeStatus(
    sessionId: string,
    status: 'not_started' | 'initializing' | 'ready'
  ): void {
    this.update(sessionId, { claudeStatus: status })
  }

  /**
   * 设置思考状态
   */
  setThinking(sessionId: string, thinking: boolean): void {
    const state = this.getOrCreate(sessionId)
    state.thinking = thinking
    state.thinkingAt = thinking ? Date.now() : 0
    state.activeAt = Date.now()

    this.activityAccumulator.addUpdate(sessionId, {
      active: true,
      activeAt: state.activeAt,
      thinking,
      thinkingAt: thinking ? state.thinkingAt : undefined
    })
  }

  /**
   * 设置控制权
   */
  setControlledByUser(sessionId: string, controlledByUser: boolean): void {
    this.update(sessionId, { controlledByUser })
  }

  /**
   * 添加活动工具调用
   */
  addToolCall(sessionId: string, toolId: string, toolCall: ToolCall): void {
    const state = this.getOrCreate(sessionId)
    state.activeToolCalls.set(toolId, toolCall)
    state.activeAt = Date.now()
  }

  /**
   * 移除活动工具调用
   */
  removeToolCall(sessionId: string, toolId: string): void {
    const state = this.get(sessionId)
    if (state) {
      state.activeToolCalls.delete(toolId)
    }
  }

  /**
   * 获取会话的活动工具调用
   */
  getToolCalls(sessionId: string): Map<string, ToolCall> {
    const state = this.get(sessionId)
    return state?.activeToolCalls ?? new Map()
  }

  /**
   * 广播活动状态更新
   */
  private broadcastActivityUpdates(updates: ActivityUpdate[]): void {
    this.mobileClients.forEach(client => {
      if (client.readyState === 1) {  // WebSocket.OPEN
        updates.forEach(update => {
          try {
            client.send(JSON.stringify(update))
          } catch (error) {
            console.error('[SessionStateManager] Failed to send activity update:', error)
          }
        })
      }
    })
  }

  /**
   * 立即刷新所有待发送的活动更新
   */
  flushActivityUpdates(): void {
    this.activityAccumulator.flushNow()
  }

  /**
   * 移除会话状态
   */
  remove(sessionId: string): void {
    this.states.delete(sessionId)
  }

  /**
   * 清空所有会话状态
   */
  clear(): void {
    this.states.clear()
    this.activityAccumulator.clear()
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.clear()
    this.activityAccumulator.destroy()
  }
}

/**
 * 创建会话状态管理器的工厂函数
 */
export function createSessionStateManager(
  mobileClients: Set<WebSocketClient>,
  options?: SessionStateManagerOptions
): SessionStateManager {
  return new SessionStateManager(mobileClients, options)
}
