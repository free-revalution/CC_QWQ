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
