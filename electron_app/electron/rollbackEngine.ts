/**
 * RollbackEngine - 批量回滚引擎
 *
 * 支持回滚到指定检查点，仅回滚文件操作
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { RollbackResult, RollbackPreview } from '../src/types/operation'
import type { CheckpointManager } from './checkpointManager'
import type { OperationExecutor } from './operationExecutor'

export class RollbackEngine {
  constructor(
    private checkpointManager: CheckpointManager,
    private operationExecutor: OperationExecutor
  ) {}

  /**
   * 回滚到指定检查点
   */
  async rollbackTo(checkpointId: string): Promise<RollbackResult> {
    console.log(`[RollbackEngine] Rolling back to checkpoint: ${checkpointId}`)
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
        const snapshotA = this.operationExecutor.getSnapshots().get(a)
        const snapshotB = this.operationExecutor.getSnapshots().get(b)
        return (snapshotB?.timestamp || 0) - (snapshotA?.timestamp || 0)
      })

    for (const [filePath, snapshotId] of entries) {
      const result = await this.rollbackFile(filePath, snapshotId)
      results.push(result)
    }

    const allSuccess = results.every(r => r.success)
    console.log(`[RollbackEngine] Rolled back ${results.length} files`)
    console.log(`[RollbackEngine] Rollback completed: ${allSuccess ? 'success' : 'partial failure'}`)

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
    const snapshot = this.operationExecutor.getSnapshots().get(snapshotId)

    if (!snapshot) {
      return {
        success: false,
        error: `Snapshot not found: ${snapshotId}`,
        files: [{ path: filePath, snapshotId, success: false }]
      }
    }

    try {
      if (snapshot.content === '') {
        // 文件原本不存在，删除它
        await fs.rm(filePath, { force: true })
      } else {
        // 恢复文件内容
        await fs.mkdir(path.dirname(filePath), { recursive: true })
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
      const snapshot = this.operationExecutor.getSnapshots().get(snapshotId)

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
