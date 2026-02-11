/**
 * ActivityAccumulator - 活动状态累积器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 将短时间内的多次状态更新合并为一次批量发送，
 * 减少 WebSocket 消息数量，提高性能。
 */

import type { ActivityUpdate } from '../types/message'

/**
 * 活动状态累积器配置
 */
export interface ActivityAccumulatorOptions {
  flushInterval?: number    // 防抖间隔（毫秒），默认 2000
  maxBufferSize?: number    // 最大缓冲区大小，默认 100
}

/**
 * 活动状态累积器
 */
export class ActivityAccumulator {
  private updates: Map<string, ActivityUpdate> = new Map()
  private timer: NodeJS.Timeout | null = null
  private flushInterval: number
  private maxBufferSize: number
  private flushCallback: (updates: ActivityUpdate[]) => void

  constructor(
    flushCallback: (updates: ActivityUpdate[]) => void,
    options: ActivityAccumulatorOptions = {}
  ) {
    this.flushCallback = flushCallback
    this.flushInterval = options.flushInterval ?? 2000
    this.maxBufferSize = options.maxBufferSize ?? 100
  }

  /**
   * 添加更新（带防抖）
   */
  addUpdate(sessionId: string, update: Partial<ActivityUpdate>): void {
    const existing = this.updates.get(sessionId)
    const now = Date.now()

    this.updates.set(sessionId, {
      type: 'activity',
      sessionId,
      active: update.active ?? existing?.active ?? true,
      activeAt: now,
      thinking: update.thinking,
      thinkingAt: update.thinkingAt ? now : existing?.thinkingAt
    })

    // 检查是否达到最大缓冲区大小
    if (this.updates.size >= this.maxBufferSize) {
      this.flushNow()
      return
    }

    // 重置计时器
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => this.flush(), this.flushInterval)
  }

  /**
   * 刷新所有待发送的更新
   */
  private flush(): void {
    if (this.updates.size === 0) return

    const updates = Array.from(this.updates.values())
    this.updates.clear()

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.flushCallback(updates)
  }

  /**
   * 立即刷新（不等待防抖）
   */
  flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flush()
  }

  /**
   * 获取当前缓冲的更新数量
   */
  get size(): number {
    return this.updates.size
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.updates.clear()
  }

  /**
   * 销毁累积器
   */
  destroy(): void {
    this.clear()
  }
}

/**
 * 创建活动状态累积器的工厂函数
 */
export function createActivityAccumulator(
  flushCallback: (updates: ActivityUpdate[]) => void,
  options?: ActivityAccumulatorOptions
): ActivityAccumulator {
  return new ActivityAccumulator(flushCallback, options)
}
