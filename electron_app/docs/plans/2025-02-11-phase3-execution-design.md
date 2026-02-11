# Phase 3: 执行能力实现设计

**日期**: 2025-02-11
**状态**: 设计完成，待实现

---

## 1. 概述

Phase 3 实现文件操作和系统命令执行能力，采用 **A → C → B** 的实现顺序：
- A. 文件读取（沙盒限制）
- C. 系统命令执行
- B. 文件写入 + 回滚

---

## 2. 整体架构

### 2.1 新增组件

创建 `electron/operationExecutor.ts` 作为所有操作执行的统一入口。

**职责**：
1. 接收执行请求（从 MCP 代理）
2. 沙盒验证（根据 approvalEngine 配置）
3. 执行操作（文件/命令）
4. 记录日志（通过 operationLogger）
5. 返回结果

**数据流向**：
```
MCP 代理 → OperationExecutor → 沙盒验证 → 执行操作 → 记录日志 → 返回结果
```

### 2.2 与现有组件的关系

| 组件 | 职责 |
|------|------|
| `approvalEngine` | 提供权限配置（allowedPaths, autoApprovePatterns）|
| `operationLogger` | 记录操作日志 |
| `mcpProxyServer` | 调用 operationExecutor 执行工具 |
| `operationExecutor` | **NEW** 执行实际操作 |

---

## 3. 文件读取实现

### 3.1 工具定义

```typescript
{
  name: 'sandbox_read_file',
  description: '读取文件内容（沙盒限制）',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' }
    },
    required: ['path']
  }
}
```

### 3.2 执行流程

```
1. 提取参数 → path
2. 路径验证 → 检查 allowedPaths 白名单
3. 执行读取 → fs.readFile()
4. 返回结果 → { success: true, content: string }
```

### 3.3 路径验证规则

- 支持通配符：`/Users/jiang/development/**`
- 支持排除模式：`!**/.env`
- 使用 `path.normalize()` 规范化路径

### 3.4 错误处理

| 场景 | 返回码 |
|------|--------|
| 路径不在白名单 | 403 权限错误 |
| 文件不存在 | 404 错误 |
| 读取失败 | 500 错误 |

---

## 4. 系统命令执行实现

### 4.1 工具定义

```typescript
{
  name: 'system_exec',
  description: '执行系统命令',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' }
    },
    required: ['command']
  }
}
```

### 4.2 执行流程

```
1. 参数验证 → command 字符串
2. 白名单检查 → autoApprovePatterns (git status, ls -la)
3. 创建子进程 → child_process.spawn()
4. 输出捕获 → stdout, stderr
5. 超时控制 → 60 秒默认超时
6. 返回结果 → { exitCode, stdout, stderr }
```

### 4.3 安全措施

- **禁止 shell 字符**：不支持 `;`, `|`, `&` 防止命令注入
- **限制可执行路径**：只允许 `/usr/bin/git`, `/bin/ls` 等
- **超时终止**：60 秒后自动杀死进程

---

## 5. 文件写入与回滚实现

### 5.1 工具定义

```typescript
{
  name: 'sandbox_write_file',
  description: '写入文件（支持回滚）',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['path', 'content']
  }
}
```

### 5.2 写入流程

```
1. 创建快照 → 保存文件当前状态到内存
2. 路径验证 → 检查 allowedPaths
3. 大小限制 → 检查内容大小（max 10MB）
4. 执行写入 → fs.writeFile()
5. 记录快照 → 保存 snapshot ID 到日志
```

### 5.3 回滚机制

**新增工具**：`sandbox_rollback`

```typescript
{
  name: 'sandbox_rollback',
  description: '回滚文件到指定快照',
  inputSchema: {
    type: 'object',
    properties: {
      snapshotId: { type: 'string' }
    },
    required: ['snapshotId']
  }
}
```

### 5.4 快照数据结构

```typescript
interface FileSnapshot {
  id: string
  type: 'file'
  path: string
  content: string | null  // null 表示文件不存在
  hash: string
  timestamp: number
  size: number
}
```

---

## 6. 实现文件清单

| 文件 | 说明 | 状态 |
|------|------|------|
| `electron/operationExecutor.ts` | 操作执行器（新建）| 待创建 |
| `electron/mcpProxyServer.ts` | 添加工具调用 | 待修改 |
| `electron/main.ts` | 注册回滚工具 | 待修改 |

---

## 7. 验收标准

- [ ] 可以读取允许路径的文件
- [ ] 拒绝读取白名单外的文件
- [ ] 可以执行批准的命令
- [ ] 可以写入文件并记录快照
- [ ] 可以回滚到之前的快照
- [ ] 所有操作都记录到日志
