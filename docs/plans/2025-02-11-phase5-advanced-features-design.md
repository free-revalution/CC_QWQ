# Phase 5: 高级功能设计

**日期**: 2025-02-11
**状态**: 设计完成，待实现

---

## 1. 概述

Phase 5实现4个高级功能，增强用户体验和操作可控性：

1. **时间线可视化** - 可折叠侧边面板，实时显示操作历史
2. **批量回滚** - 支持回滚到任意检查点
3. **检查点管理** - 自动创建命名检查点
4. **日志导出** - 支持JSON/CSV/Markdown三种格式

**实现方式**: 4个功能同时开发

---

## 2. 整体架构

### 2.1 新增组件

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| 时间线面板 | `src/renderer/components/TimelinePanel.tsx` | 渲染可折叠侧边面板，显示操作历史 |
| 检查点管理器 | `electron/checkpointManager.ts` | 自动创建和管理检查点 |
| 回滚引擎 | `electron/rollbackEngine.ts` | 批量回滚到指定检查点（接收OperationExecutor以动态获取快照） |
| 日志导出器 | `electron/logExporter.ts` | 导出操作日志 |

### 2.2 数据流向

```
UI组件 → IPC → 主进程服务 → OperationExecutor/Logger → 返回结果 → UI更新
```

---

## 3. 时间线可视化

### 3.1 UI布局

- **位置**: 对话页面右侧侧边面板
- **宽度**: 320px（展开），40px（折叠）
- **折叠状态**: 显示操作计数徽章

### 3.2 操作条目显示

**详细信息模式**包含：

```typescript
interface TimelineEntry {
  id: string
  timestamp: number
  tool: string
  status: 'pending' | 'approved' | 'denied' | 'success' | 'error'
  duration?: number
  summary: string  // 参数摘要（如："path: config.json, size: 1.2KB"）
}
```

### 3.3 实时更新

- 使用 `ipcRenderer.on('operation-log-update')` 监听新操作
- 新操作到达时自动滚动到顶部
- 支持过滤：按操作类型、状态筛选

### 3.4 样式规范

| 状态 | 颜色 | 图标 |
|------|------|------|
| 成功 | 绿色左边框 | ✓ |
| 失败 | 红色左边框 | ✗ |
| 等待审批 | 黄色左边框 | ⏱ |

---

## 4. 检查点管理

### 4.1 自动创建机制

每次 `sandbox_write_file` 成功后自动创建：

```typescript
interface Checkpoint {
  id: string              // UUID
  name: string            // "checkpoint-20250211-143052"
  description: string     // "Auto: Write config.json"
  timestamp: number
  fileSnapshots: Map<string, FileSnapshot>
}
```

### 4.2 命名规则

- **格式**: `checkpoint-YYYYMMDD-HHMMSS`
- **描述**: `"Auto: Write <filename>"` 或 `"Manual: <user-input>"`

### 4.3 生命周期

- 最大保留50个检查点（FIFO清理）
- 定期清理（每小时检查一次）
- 可配置保留天数（默认7天）

### 4.4 API

```typescript
class CheckpointManager {
  list(): Checkpoint[]
  get(id: string): Checkpoint | null
  createManual(name: string, description: string): Checkpoint
  delete(id: string): boolean
  getSnapshotsSince(timestamp: number): FileSnapshot[]
}
```

---

## 5. 批量回滚

### 5.1 回滚范围

**仅文件操作** - `sandbox_write_file` 的修改

### 5.2 回滚流程

```
1. 用户在时间线选择"回滚到"某检查点
2. 显示确认对话框：
   - 列出将要修改的文件清单
   - 显示新→旧的内容对比（diff摘要）
   - 警告：不可撤销
3. 用户确认后执行（按时间倒序恢复快照）
4. 记录回滚操作到日志
5. 刷新时间线UI
```

### 5.3 API

```typescript
class RollbackEngine {
  constructor(
    private checkpointManager: CheckpointManager,
    private operationExecutor: OperationExecutor  // 动态获取快照，避免引用过时
  ) {}

  rollbackTo(checkpointId: string): RollbackResult
  rollbackFile(filePath: string, snapshotId: string): RollbackResult
  getDiff(filePath: string, fromSnapshot: string, toSnapshot: string): DiffSummary
  previewRollback(checkpointId: string): PreviewResult
}
```

> **设计说明**: RollbackEngine接收OperationExecutor引用而非直接接收`Map<string, FileSnapshot>`，通过调用`operationExecutor.getSnapshots()`动态获取最新快照状态。这避免了在初始化时捕获快照Map引用导致的过时引用问题。

### 5.4 安全措施

- 回滚前验证快照完整性（SHA256校验）
- 回滚失败时自动回滚到回滚前状态
- 禁止回滚正在进行写入操作的文件

---

## 6. 日志导出

### 6.1 支持格式

| 格式 | 用途 |
|------|------|
| JSON | 完整数据，便于程序处理 |
| CSV | Excel分析 |
| Markdown | 人类阅读 |

### 6.2 导出选项

- 时间范围筛选（起止时间）
- 操作类型筛选
- 状态筛选（全部/仅成功/仅失败）

### 6.3 输出示例

**JSON格式**:
```json
{
  "exportTime": "2025-02-11T14:30:52Z",
  "operations": [
    {
      "id": "op-123",
      "timestamp": 1736619252000,
      "tool": "sandbox_write_file",
      "params": {"path": "config.json"},
      "result": {"success": true},
      "duration": 45
    }
  ]
}
```

**CSV格式**:
```csv
Timestamp,Tool,Status,Duration,Params Summary
2025-02-11 14:30:52,sandbox_write_file,success,45ms,"path: config.json"
```

**Markdown格式**:
```markdown
# Operation Log Export
**Generated**: 2025-02-11 14:30:52

## 2025-02-11 14:30:52 - sandbox_write_file
✓ Success | 45ms
- Path: `config.json`
- Snapshot: `snapshot-abc123`
```

---

## 7. 实现文件清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/renderer/components/TimelinePanel.tsx` | 时间线UI组件 | 新建 |
| `electron/checkpointManager.ts` | 检查点管理器 | 新建 |
| `electron/rollbackEngine.ts` | 批量回滚引擎 | 新建 |
| `electron/logExporter.ts` | 日志导出器 | 新建 |
| `electron/operationExecutor.ts` | 集成检查点自动创建 | 修改 |
| `electron/ipcHandlers.ts` | 新增IPC端点 | 修改 |
| `src/renderer/styles/TimelinePanel.css` | 时间线样式 | 新建 |
| `src/types/timeline.ts` | 时间线类型定义 | 新建 |

---

## 8. 验收标准

- [ ] 时间线面板正确显示操作历史
- [ ] 时间线支持折叠/展开
- [ ] 每次文件写入自动创建检查点
- [ ] 可以回滚到任意检查点
- [ ] 回滚前显示确认对话框
- [ ] 日志可以导出为JSON/CSV/Markdown格式
- [ ] 所有UI使用中文
