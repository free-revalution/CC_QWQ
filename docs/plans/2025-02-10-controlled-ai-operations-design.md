# 可控 AI 操作系统设计文档

**项目**: ClaudePhone - 可控 AI 操作系统
**日期**: 2025-02-10
**状态**: 设计阶段

---

## 1. 概述

### 1.1 项目背景

用户希望在 Claude Code 的基础上，实现一个**可控的 AI 操作系统**，让 Claude 能够通过对话执行实际的电脑操作（浏览器自动化、文件操作、命令执行等），同时保持完全的可控性。

### 1.2 设计目标

| 可控性维度 | 目标 |
|-----------|------|
| **权限控制** | 每个操作都需要用户明确批准或匹配自动批准规则 |
| **操作范围限制** | 通过沙盒规则限制文件路径、网站白名单、资源配额 |
| **可观测性** | 实时日志展示所有操作，用户知道 Claude 在做什么 |
| **可撤销性** | 操作前创建快照，支持单操作回滚和批量回滚 |

### 1.3 与 OpenClaw 的对比

| 方面 | OpenClaw | 本方案 |
|------|----------|--------|
| **运行模式** | 完全自主，无人值守 | 对话驱动，用户在环路 |
| **执行层** | 直接调用工具 | 审批层 → 沙盒层 → 操作层 |
| **控制权** | Agent 自主决策 | 用户始终有最终否决权 |
| **可观测性** | 后台日志 | 实时日志面板 |
| **架构** | Gateway-Agent 模式 | MCP 代理 + 审批引擎 |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Electron 应用                                        │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         用户界面层                                       │ │
│  │  ┌─────────────┬──────────────┬─────────────────┬──────────────────┐  │ │
│  │  │ 对话输入/输出 │ 审批弹窗      │   实时日志面板   │   时间线/回滚    │  │ │
│  │  └─────────────┴──────────────┴─────────────────┴──────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                        ↓                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Claude Code CLI (PTY 会话)                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                        ↓                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      MCP 代理服务器                    │ │
│  │  • SSE 传输: http://localhost:3010/mcp                                  │ │
│  │  • 环境变量注入: MCP_SERVERS 配置到 Claude Code                          │ │
│  │  • 实现标准 MCP 协议                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                        ↓                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        可控执行层                  │ │
│  │  ┌──────────────┬──────────────┬─────────────────────────────────────┐ │ │
│  │  │  审批引擎    │  执行器      │       日志系统                      │ │ │
│  │  │  (Approval)  │  (Executor)  │    (Operation Logger)               │ │ │
│  │  │              │              │                                     │ │ │
│  │  │• 权限检查    │• 快照管理    │• 实时日志收集                       │ │ │
│  │  │• 用户确认    │• 操作包装    │• 结构化日志                         │ │ │
│  │  │• 规则引擎    │• 回滚机制    │• IPC 推送                           │ │ │
│  │  │• 记忆选择    │• 时间线      │• 过滤与搜索                         │ │ │
│  │  └──────────────┴──────────────┴─────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                        ↓                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        实际操作层                                        │ │
│  │  ┌──────────────┬──────────────┬─────────────────────────────────────┐ │ │
│  │  │  浏览器自动化 │  文件操作    │       系统命令                      │ │ │
│  │  │  (Playwright)│  (fs-extra)  │    (child_process)                  │ │ │
│  │  └──────────────┴──────────────┴─────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

1. **MCP 优先** - 使用官方 MCP 协议与 Claude Code 集成
2. **审批优先** - 所有操作必须经过审批引擎检查
3. **轻量部署** - MCP 代理运行在 Electron 主进程内
4. **渐进实现** - 分阶段开发，逐步添加功能

---

## 3. MCP 代理服务器

### 3.1 技术选型

| 方案 | 选择 | 理由 |
|------|------|------|
| 传输方式 | SSE (Server-Sent Events) | 比 stdio 更适合集成到 Electron |
| 部署方式 | 主进程内 | 轻量、简单、无需额外进程管理 |
| SDK | @modelcontextprotocol/sdk | 官方 SDK，持续维护 |

### 3.2 端口配置

```typescript
MCP_PROXY_PORT = 3010
MCP_ENDPOINT = http://localhost:3010/mcp
HEALTH_CHECK = http://localhost:3010/health
```

### 3.3 MCP 工具定义

```typescript
interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required: string[]
  }
}

// 支持的工具列表
const MCP_TOOLS: MCPTool[] = [
  // 浏览器工具
  {
    name: 'browser_navigate',
    description: 'Navigate to a URL in controlled browser',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_click',
    description: 'Click an element on current page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector' }
      },
      required: ['selector']
    }
  },
  {
    name: 'browser_screenshot',
    description: 'Take screenshot of current page',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  // 文件工具
  {
    name: 'sandbox_read_file',
    description: 'Read a file from the allowed sandbox directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within sandbox' }
      },
      required: ['path']
    }
  },
  {
    name: 'sandbox_write_file',
    description: 'Write content to a file in the sandbox',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within sandbox' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    }
  },

  // 系统工具
  {
    name: 'system_exec',
    description: 'Execute a command in the project directory',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        description: { type: 'string', description: 'What this command does' }
      },
      required: ['command', 'description']
    }
  }
]
```

### 3.4 环境变量配置

Claude Code 通过环境变量发现 MCP 服务器：

```typescript
const MCP_CONFIG = JSON.stringify([
  {
    name: 'claudephone-proxy',
    transport: 'sse',
    url: 'http://localhost:3010/mcp'
  }
])

// 注入到 Claude Code PTY 会话
const env = {
  ...process.env,
  MCP_SERVERS: MCP_CONFIG
}
```

---

## 4. 审批引擎 (Approval Engine)

### 4.1 核心数据结构

```typescript
// 工具权限配置
interface ToolPermission {
  tool: string
  requiresApproval: boolean
  riskLevel: 'low' | 'medium' | 'high'
  autoApprovePatterns?: string[]
  sandboxConstraints?: {
    allowedPaths?: string[]
    allowedUrls?: string[]
    maxFileSize?: number
  }
}

// 用户偏好设置
interface UserPreferences {
  autoApproveLowRisk: boolean
  requireConfirmation: boolean
  rememberChoices: boolean
  notificationLevel: 'all' | 'risky' | 'errors'
}

// 审批决策
interface ApprovalDecision {
  approved: boolean
  reason: string
  autoApproved: boolean
  userChoice?: 'once' | 'always' | 'session'
}
```

### 4.2 默认权限配置

```typescript
const DEFAULT_TOOL_PERMISSIONS: Map<string, ToolPermission> = new Map([
  // 浏览器导航 - 中风险
  ['browser_navigate', {
    tool: 'browser_navigate',
    requiresApproval: true,
    riskLevel: 'medium',
    autoApprovePatterns: [
      'https://docs.claude.com/**',
      'https://github.com/**'
    ],
    sandboxConstraints: {
      allowedUrls: ['https://**']
    }
  }],

  // 浏览器点击 - 低风险
  ['browser_click', {
    tool: 'browser_click',
    requiresApproval: false,
    riskLevel: 'low'
  }],

  // 文件读取 - 低风险
  ['sandbox_read_file', {
    tool: 'sandbox_read_file',
    requiresApproval: false,
    riskLevel: 'low',
    sandboxConstraints: {
      allowedPaths: [
        '/Users/jiang/development/**',
        '!**/.env',
        '!**/secrets/**'
      ]
    }
  }],

  // 文件写入 - 高风险
  ['sandbox_write_file', {
    tool: 'sandbox_write_file',
    requiresApproval: true,
    riskLevel: 'high',
    sandboxConstraints: {
      allowedPaths: [
        '/Users/jiang/development/**',
        '!**/*.exe',
        '!**/*.sh'
      ],
      maxFileSize: 10 * 1024 * 1024
    }
  }],

  // 系统命令 - 高风险
  ['system_exec', {
    tool: 'system_exec',
    requiresApproval: true,
    riskLevel: 'high',
    autoApprovePatterns: [
      'git status',
      'git diff',
      'ls -la'
    ]
  }]
])
```

### 4.3 审批流程

```
工具调用请求
    ↓
检查是否有记住的选择
    ↓ 是
自动批准 → 返回
    ↓ 否
检查自动批准模式
    ↓ 匹配
自动批准 → 返回
    ↓ 不匹配
检查风险等级
    ↓ 低风险 + 自动批准启用
自动批准 → 返回
    ↓ 否
显示用户审批弹窗
    ↓
等待用户响应
    ↓
批准/拒绝 → 记住选择 → 返回
```

---

## 5. 操作执行器 (Operation Executor)

### 5.1 核心数据结构

```typescript
type SnapshotType = FileSnapshot | BrowserStateSnapshot | DirectorySnapshot

interface FileSnapshot {
  type: 'file'
  path: string
  content: string
  hash: string
  timestamp: number
  size: number
}

interface OperationRecord {
  id: string
  type: OperationType
  timestamp: number
  params: any
  result?: any
  error?: string
  snapshotBefore: SnapshotType
  rollbackData?: any
  duration: number
}

interface Timeline {
  operations: OperationRecord[]
  checkpoints: Map<string, string>
  currentTime: number
}
```

### 5.2 执行包装流程

```
1. 创建操作前快照
    ↓
2. 执行实际操作
    ↓
3. 记录结果
    ↓
4. 清理旧快照
    ↓
5. 失败时自动回滚
```

### 5.3 快照策略

| 操作类型 | 快照类型 | 说明 |
|---------|---------|------|
| file_write | FileSnapshot | 记录文件原始内容 |
| file_delete | FileSnapshot | 记录将被删除的文件 |
| browser_navigate | BrowserStateSnapshot | 记录当前 URL、cookies |
| system_exec | DirectorySnapshot | 记录可能受影响的文件 |

### 5.4 回滚机制

```typescript
// 单操作回滚
async rollback(operationId: string): Promise<boolean>

// 回滚到检查点
async rollbackToCheckpoint(checkpointName: string): Promise<boolean>

// 创建检查点
createCheckpoint(name: string): void
```

---

## 6. 日志系统 (Operation Logger)

### 6.1 日志级别

| 级别 | 图标 | 用途 |
|-----|------|------|
| info | 🔄 | 一般信息 |
| success | ✅ | 操作成功 |
| warning | ⏸️ | 等待批准 |
| error | ❌ | 操作失败/拒绝 |

### 6.2 操作状态

| 状态 | 说明 |
|-----|------|
| pending | 等待执行 |
| awaiting_approval | 等待用户批准 |
| running | 正在执行 |
| completed | 执行成功 |
| failed | 执行失败 |
| denied | 用户拒绝 |

### 6.3 日志条目结构

```typescript
interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  status: OperationStatus
  category: 'tool' | 'approval' | 'system' | 'rollback'
  tool?: string
  title: string
  message: string
  details?: any
  duration?: number
  metadata?: {
    projectId?: string
    conversationId?: string
  }
}
```

### 6.4 实时推送

```
主进程 (OperationLogger)
    ↓ IPC event: 'log-entry'
渲染进程
    ↓ WebSocket
移动端
```

---

## 7. 用户界面组件

### 7.1 审批弹窗

**位置**: `src/components/ui/ApprovalDialog.tsx`

```typescript
interface ApprovalDialogProps {
  requestId: string
  tool: string
  params: any
  riskLevel: 'low' | 'medium' | 'high'
  reason?: string
  onRespond: (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => void
}
```

**UI 元素**:
- 风险等级指示器（颜色 + 图标）
- 工具名称和描述
- 参数展示（JSON 格式化）
- 三个操作按钮：
  - 拒绝
  - 允许一次
  - 允许且不再询问

### 7.2 实时日志面板

**位置**: `src/components/ui/OperationLogPanel.tsx`

**功能**:
- 实时滚动显示日志
- 状态图标和颜色编码
- 搜索和过滤
- 日志导出
- 统计信息（总数、运行中、完成、失败）

### 7.3 时间线视图

**位置**: `src/components/ui/TimelineView.tsx`

**功能**:
- 按时间顺序显示操作历史
- 每个操作显示：类型、时间、耗时、参数
- 单操作回滚按钮
- 检查点管理

---

## 8. 文件清单

### 8.1 新增文件

```
electron/
├── mcp-proxy-server.ts       # MCP 代理服务器
├── approval-engine.ts        # 审批引擎
├── operation-executor.ts     # 操作执行器
└── operation-logger.ts       # 日志系统

src/components/ui/
├── ApprovalDialog.tsx        # 审批弹窗
├── OperationLogPanel.tsx     # 日志面板
└── TimelineView.tsx          # 时间线视图

src/types/
└── operation.ts              # 操作相关类型定义
```

### 8.2 修改文件

```
electron/main.ts              # 集成所有组件
electron/preload.js           # 添加 IPC 通信
src/lib/ipc.ts                # IPC 封装
src/types/index.ts            # 添加类型导出
src/pages/ConversationPage.tsx  # 集成 UI 组件
```

---

## 9. 依赖清单

```bash
# MCP SDK
npm install @modelcontextprotocol/sdk

# 浏览器自动化
npm install playwright
npx playwright install chromium

# 文件操作增强
npm install fs-extra

# 模式匹配
npm install minimatch

# HTTP 服务器（SSE 传输）
npm install express
npm install @types/express
```

---

## 10. 实现计划

### Phase 1: 核心框架 (2-3 天)

**目标**: 搭建基础架构，实现 MCP 通信

- [ ] MCP 代理服务器（仅工具定义）
- [ ] 审批引擎（规则匹配，无 UI）
- [ ] 基础日志系统
- [ ] IPC 通信框架

**验收标准**:
- Claude Code 能发现并连接到 MCP 代理
- 工具调用能到达审批引擎
- 日志能推送到渲染进程

### Phase 2: 用户界面 (2-3 天)

**目标**: 实现用户交互界面

- [ ] 审批弹窗组件
- [ ] 实时日志面板
- [ ] IPC 事件处理
- [ ] 响应式布局

**验收标准**:
- 工具调用时显示审批弹窗
- 用户可以批准/拒绝操作
- 日志实时更新显示

### Phase 3: 执行能力 (3-4 天)

**目标**: 实现文件和命令操作

- [ ] 文件读取（沙盒限制）
- [ ] 文件写入（快照 + 回滚）
- [ ] 系统命令执行
- [ ] 完善审批规则

**验收标准**:
- 可以读取允许路径的文件
- 可以写入文件并回滚
- 可以执行批准的命令

### Phase 4: 浏览器自动化 (2-3 天)

**目标**: 集成 Playwright

- [ ] Playwright 初始化
- [ ] 页面导航
- [ ] 元素点击
- [ ] 截图功能

**验收标准**:
- 可以导航到 URL
- 可以点击页面元素
- 可以获取页面截图

### Phase 5: 高级功能 (2-3 天)

**目标**: 完善体验和功能

- [ ] 时间线可视化
- [ ] 批量回滚
- [ ] 检查点管理
- [ ] 日志导出
- [ ] 移动端同步

**验收标准**:
- 可以查看完整操作历史
- 可以回滚到任意检查点
- 移动端能看到实时日志

---

## 11. 风险与挑战

### 11.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| MCP 协议变更 | 高 | 使用官方 SDK，关注更新 |
| SSE 连接稳定性 | 中 | 实现重连机制 |
| 快照存储占用 | 中 | 限制快照数量和年龄 |
| 浏览器资源占用 | 中 | 单例浏览器实例 |

### 11.2 用户体验风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 审批弹窗过于频繁 | 高 | 智能规则 + 记住选择 |
| 日志信息过载 | 中 | 过滤 + 搜索 |
| 回滚不完整 | 中 | 明确回滚边界 |

### 11.3 安全风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 沙盒绕过 | 高 | 严格的路径白名单 |
| 恶意命令注入 | 高 | 命令参数验证 |
| 敏感文件访问 | 中 | 排除规则 + 明确警告 |

---

## 12. 参考资料

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server)
- [Claude Code MCP Setup](https://code.claude.com/docs/en/mcp)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)

---

## 附录 A: 术语表

| 术语 | 说明 |
|------|------|
| MCP | Model Context Protocol，AI 工具调用标准协议 |
| SSE | Server-Sent Events，服务器推送事件 |
| PTY | Pseudo Terminal，伪终端 |
| IPC | Inter-Process Communication，进程间通信 |
| Sandbox | 沙盒，受限的执行环境 |
| Snapshot | 快照，操作前的状态记录 |
| Checkpoint | 检查点，命名的时间点 |
| Rollback | 回滚，撤销操作 |

---

## 附录 B: 代码示例

### B.1 启动 MCP 代理服务器

```typescript
// electron/main.ts

import { MCPProxyServer } from './mcp-proxy-server.js'
import { ApprovalEngine } from './approval-engine.js'
import { OperationExecutor } from './operation-executor.js'
import { OperationLogger } from './operation-logger.js'

// 创建全局实例
const approvalEngine = new ApprovalEngine()
const operationExecutor = new OperationExecutor()
const operationLogger = new OperationLogger()

// 启动 MCP 代理
app.whenReady().then(async () => {
  const mcpProxy = new MCPProxyServer(3010, approvalEngine, operationExecutor, operationLogger)
  await mcpProxy.start()
  console.log('[MCP Proxy] Started on port 3010')
})
```

### B.2 配置 Claude Code 环境

```typescript
// 修改 executeClaudeRequest 函数

async function executeClaudeRequest(conversationId: string, projectPath: string, message: string) {
  const mcpConfig = JSON.stringify([
    {
      name: 'claudephone-proxy',
      transport: 'sse',
      url: 'http://localhost:3010/mcp'
    }
  ])

  const env = {
    ...process.env,
    MCP_SERVERS: mcpConfig
  }

  const pty = spawnPty('claude', ['--stdio'], {
    cwd: projectPath,
    env: env
  })
  // ...
}
```

---

**文档版本**: 1.0
**最后更新**: 2025-02-10
**作者**: Claude Code
