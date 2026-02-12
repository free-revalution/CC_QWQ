# Happy 架构改进设计文档

**日期**: 2025-02-10
**参考**: [Happy Project](https://github.com/slopus/happy)
**作者**: Claude Code with Happy

---

## 1. 概述

本文档描述了基于 Happy 项目架构的移动端-桌面端同步功能改进方案。改进内容包括：

1. **增强的消息类型系统** - 结构化消息内容，支持工具调用和结果
2. **工具调用状态追踪** - 完整的工具生命周期管理
3. **实时状态同步机制** - WebSocket 实时活动状态更新

---

## 2. 当前架构分析

### 2.1 现有消息类型

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string  // 纯文本
  timestamp: number
}
```

**局限性**：
- 无法区分文本和工具调用
- 没有工具状态追踪
- 缺少权限信息关联

### 2.2 现有 WebSocket 消息

```typescript
type WSMessageType =
  | 'permission_request'
  | 'permission_response'
  | 'sync_status'
  | 'ping'
  | 'pong'
```

**局限性**：
- 缺少实时活动状态
- 没有增量消息更新
- 缺少工具状态同步

---

## 3. 改进方案

### 3.1 增强的消息类型系统

#### 3.1.1 内容块类型

```typescript
/**
 * 文本内容块
 */
interface TextContent {
  type: 'text'
  text: string
}

/**
 * 工具调用内容块（Claude 调用工具）
 */
interface ToolUseContent {
  type: 'tool_use'
  id: string                    // 工具调用唯一 ID
  name: ClaudeToolType          // 工具名称
  input: any                    // 工具输入参数
  description?: string           // 可读描述
}

/**
 * 工具结果内容块（工具执行返回）
 */
interface ToolResultContent {
  type: 'tool_result'
  tool_use_id: string           // 对应的 tool_use.id
  content: string | Array<{ type: 'text'; text: string }>
  is_error?: boolean
  permissions?: {               // 权限决策信息
    date: number
    result: 'approved' | 'denied'
    mode?: string
    decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
  }
}

/**
 * 消息内容块类型
 */
type MessageContent = TextContent | ToolUseContent | ToolResultContent
```

#### 3.1.2 增强的消息接口

```typescript
/**
 * 增强的消息接口
 */
interface EnhancedMessage {
  id: string
  localId?: string               // 移动端本地 ID
  createdAt: number
  role: 'user' | 'assistant' | 'system'
  content: MessageContent[]      // 内容块数组
  // 可选元数据
  meta?: {
    sentFrom?: 'desktop' | 'mobile' | 'web'
    permissionMode?: 'default' | 'auto-approve' | 'strict'
    model?: string
  }
  // 使用量统计
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}
```

#### 3.1.3 消息类型判断

```typescript
/**
 * 消息类型（用于前端渲染分发）
 */
type MessageKind =
  | 'user-text'       // 用户纯文本消息
  | 'agent-text'      // AI 纯文本回复
  | 'tool-call'       // 工具调用（包含子消息）
  | 'mode-switch'     // 模式切换事件

/**
 * 用户文本消息
 */
interface UserTextMessage {
  kind: 'user-text'
  id: string
  localId: string | null
  createdAt: number
  text: string
  displayText?: string
  meta?: MessageMeta
}

/**
 * AI 文本消息
 */
interface AgentTextMessage {
  kind: 'agent-text'
  id: string
  localId: string | null
  createdAt: number
  text: string
  meta?: MessageMeta
}

/**
 * 工具调用消息
 */
interface ToolCallMessage {
  kind: 'tool-call'
  id: string
  localId: string | null
  createdAt: number
  tool: ToolCall
  children: Message[]
  meta?: MessageMeta
}

/**
 * 模式切换消息
 */
interface ModeSwitchMessage {
  kind: 'mode-switch'
  id: string
  createdAt: number
  event: AgentEvent
  meta?: MessageMeta
}

type Message = UserTextMessage | AgentTextMessage | ToolCallMessage | ModeSwitchMessage
```

---

### 3.2 工具调用状态追踪

#### 3.2.1 ToolCall 接口

```typescript
/**
 * 工具调用状态
 */
type ToolCallState = 'running' | 'completed' | 'error' | 'pending'

/**
 * 权限决策信息
 */
interface ToolPermission {
  id: string
  status: 'pending' | 'approved' | 'denied' | 'canceled'
  reason?: string
  mode?: string
  allowedTools?: string[]
  decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
  date?: number
}

/**
 * 工具调用接口
 */
interface ToolCall {
  name: ClaudeToolType
  state: ToolCallState
  input: any
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  description: string | null
  result?: any
  permission?: ToolPermission
}
```

#### 3.2.2 ToolCallManager

```typescript
/**
 * 工具调用管理器
 */
class ToolCallManager {
  private calls: Map<string, ToolCall> = new Map()

  /**
   * 创建新的工具调用
   */
  create(id: string, name: ClaudeToolType, input: any): ToolCall {
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
  updateState(id: string, state: ToolCallState, result?: any): void {
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
   * 提取可读描述
   */
  private extractDescription(name: ClaudeToolType, input: any): string | null {
    switch (name) {
      case 'Read': return `读取 ${input.filePath || input.path}`
      case 'Write': return `写入 ${input.filePath || input.path}`
      case 'Bash': return `执行: ${input.command?.split(' ')[0] || '命令'}`
      case 'Edit': return `编辑 ${input.filePath || input.path}`
      case 'Glob': return `搜索文件: ${input.pattern}`
      case 'Grep': return `搜索内容: ${input.pattern}`
      case 'WebFetch': return `请求: ${input.url}`
      default: return null
    }
  }
}
```

---

### 3.3 实时状态同步机制

#### 3.3.1 扩展的 WebSocket 消息类型

```typescript
/**
 * WebSocket 更新类型
 */
type WSUpdateType =
  | 'new-message'        // 新消息
  | 'update-message'     // 消息更新（工具状态变化）
  | 'conversation-list'  // 对话列表更新
  | 'session-state'      // 会话状态变化
  | 'activity'           // 实时活动状态（ephemeral）

/**
 * 实时活动状态更新
 */
interface ActivityUpdate {
  type: 'activity'
  sessionId: string      // 会话 ID
  active: boolean        // 是否活跃
  activeAt: number       // 最后活跃时间
  thinking?: boolean     // AI 是否正在思考
  thinkingAt?: number    // 开始思考时间
}

/**
 * 会话状态更新
 */
interface SessionStateUpdate {
  type: 'session-state'
  sessionId: string
  claudeStatus: 'not_started' | 'initializing' | 'ready'
  controlledByUser: boolean  // 当前控制方
  lastMessage?: Message
  updatedAt: number
}

/**
 * 消息更新（工具状态变化）
 */
interface MessageUpdate {
  type: 'update-message'
  sessionId: string
  messageId: string
  content: MessageContent
  updatedAt: number
}
```

#### 3.3.2 活动状态累积器（防抖优化）

```typescript
/**
 * 活动状态累积器
 * 将短时间内的多次更新合并为一次批量发送
 */
class ActivityAccumulator {
  private updates: Map<string, ActivityUpdate> = new Map()
  private timer: NodeJS.Timeout | null = null
  private flushInterval: number = 2000  // 2秒防抖
  private flushCallback: (updates: ActivityUpdate[]) => void

  constructor(flushCallback: (updates: ActivityUpdate[]) => void, flushInterval: number = 2000) {
    this.flushCallback = flushCallback
    this.flushInterval = flushInterval
  }

  /**
   * 添加更新（带防抖）
   */
  addUpdate(sessionId: string, update: Partial<ActivityUpdate>): void {
    const existing = this.updates.get(sessionId)

    this.updates.set(sessionId, {
      type: 'activity',
      sessionId,
      active: update.active ?? existing?.active ?? true,
      activeAt: Date.now(),
      thinking: update.thinking,
      thinkingAt: update.thinkingAt ? Date.now() : existing?.thinkingAt
    })

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
}
```

#### 3.3.3 会话状态管理

```typescript
/**
 * 会话状态
 */
interface SessionState {
  sessionId: string
  claudeStatus: 'not_started' | 'initializing' | 'ready'
  controlledByUser: boolean        // true=用户控制, false=AI 控制
  activeToolCalls: Map<string, ToolCall>
  lastActivity: number
  thinking: boolean
  thinkingAt: number
  activeAt: number
}

/**
 * 会话状态管理器
 */
class SessionStateManager {
  private states: Map<string, SessionState> = new Map()
  private activityAccumulator: ActivityAccumulator
  private mobileClients: Set<WebSocketClient>

  constructor(mobileClients: Set<WebSocketClient>) {
    this.mobileClients = mobileClients
    this.activityAccumulator = new ActivityAccumulator(
      (updates) => this.broadcastActivityUpdates(updates)
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
   * 更新会话状态
   */
  update(sessionId: string, updates: Partial<SessionState>): void {
    const state = this.getOrCreate(sessionId)
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
      thinkingAt: state.thinking > 0 ? state.thinkingAt : undefined
    })
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
   * 广播活动状态更新
   */
  private broadcastActivityUpdates(updates: ActivityUpdate[]): void {
    this.mobileClients.forEach(client => {
      if (client.readyState === 1) {  // WebSocket.OPEN
        updates.forEach(update => {
          client.send(JSON.stringify(update))
        })
      }
    })
  }

  /**
   * 获取会话状态
   */
  get(sessionId: string): SessionState | undefined {
    return this.states.get(sessionId)
  }

  /**
   * 移除会话状态
   */
  remove(sessionId: string): void {
    this.states.delete(sessionId)
  }
}
```

---

## 4. 数据流设计

### 4.1 消息发送流程

```
[移动端/桌面端]
    ↓ 发送消息
[IPC / WebSocket]
    ↓
[ToolCallManager.create()]  →  pending
    ↓
[开始执行]                  →  running
    ↓
[请求权限]                  →  permission pending
    ↓
[用户批准]
    ↓
[执行完成]                  →  completed
    ↓
[广播更新给移动端]
```

### 4.2 活动状态同步流程

```
[Claude 开始响应]
    ↓
[SessionStateManager.setThinking(true)]
    ↓
[ActivityAccumulator.addUpdate()]
    ↓ (2秒防抖)
[批量广播 activity 更新]
    ↓
[移动端更新 UI 指示器]
```

---

## 5. 文件变更清单

### 5.1 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/types/message.ts` | 消息类型定义 |
| `src/lib/toolCallManager.ts` | 工具调用管理器 |
| `src/lib/sessionStateManager.ts` | 会话状态管理器 |
| `src/lib/activityAccumulator.ts` | 活动状态累积器 |
| `src/components/ui/ToolCallView.tsx` | 工具调用展示组件 |

### 5.2 修改文件

| 文件路径 | 主要变更 |
|---------|---------|
| `src/types/index.ts` | 添加新类型定义 |
| `electron/main.ts` | WebSocket 消息处理、状态同步 |
| `src/pages/ConversationPage.tsx` | 消息渲染、工具状态显示 |
| `mobile-test.html` | 更新 WebSocket 消息处理 |

---

## 6. 实施步骤

### Phase 1: 类型定义
1. 创建 `src/types/message.ts`
2. 定义所有消息内容类型
3. 定义 ToolCall、ToolPermission 接口
4. 更新 `src/types/index.ts` 导出

### Phase 2: 后端核心
1. 创建 `ToolCallManager` 类
2. 创建 `SessionStateManager` 类
3. 创建 `ActivityAccumulator` 类
4. 集成到 `electron/main.ts`

### Phase 3: WebSocket 扩展
1. 添加新的消息类型处理
2. 实现 activity 广播
3. 实现消息更新推送
4. 更新移动端协议

### Phase 4: 前端组件
1. 创建 `ToolCallView` 组件
2. 创建 `ToolStatusIndicator` 组件
3. 更新 `MessageContent` 支持新消息类型
4. 添加活动状态指示器

### Phase 5: 测试
1. 单元测试：工具调用状态流转
2. 集成测试：WebSocket 消息同步
3. UI 测试：工具状态显示
4. 端到端测试：移动端-桌面端完整流程

---

## 7. 兼容性考虑

### 7.1 向后兼容

- 保留现有 `Message` 接口作为 `SimpleMessage`
- 新消息类型通过 `kind` 字段区分
- WebSocket 消息添加 `version` 字段

### 7.2 渐进式迁移

```typescript
// 联合类型，支持新旧格式
type CompatibleMessage = SimpleMessage | EnhancedMessage

// 版本检测
function isEnhancedMessage(msg: any): msg is EnhancedMessage {
  return Array.isArray(msg.content)
}
```

---

## 8. 性能优化

### 8.1 防抖与节流

- 活动状态更新：2秒防抖
- 工具状态更新：立即发送（关键状态）
- 对话列表更新：5秒防抖

### 8.2 批量操作

- 消息批量解密
- 状态批量广播
- 增量更新传输

---

## 9. 安全考虑

### 9.1 权限验证

- 工具调用需要权限验证
- 跨设备操作需要确认
- 敏感操作记录审计日志

### 9.2 数据加密

- WebSocket 消息加密（可选）
- 本地存储加密
- 传输层安全（WSS）

---

## 10. 测试计划

### 10.1 单元测试

- `ToolCallManager` 状态流转测试
- `ActivityAccumulator` 防抖测试
- `SessionStateManager` 状态管理测试

### 10.2 集成测试

- WebSocket 消息收发测试
- 工具调用生命周期测试
- 状态同步测试

### 10.3 端到端测试

- 移动端发送消息 → 桌面端执行 → 状态同步
- 桌面端工具调用 → 移动端批准 → 结果返回
- 多设备同时连接状态同步

---

## 附录 A: Happy 项目关键类型参考

```typescript
// Happy 的 NormalizedAgentContent
type NormalizedAgentContent =
  | { type: 'text'; text: string; uuid: string; parentUUID: string | null }
  | { type: 'tool-call'; id: string; name: string; input: any; description: string | null; uuid: string; parentUUID: string | null }
  | { type: 'tool-result'; tool_use_id: string; content: any; is_error: boolean; uuid: string; parentUUID: string | null; permissions?: {...} }
  | { type: 'summary'; summary: string }
  | { type: 'sidechain'; uuid: string; prompt: string }

// Happy 的 ToolCall
type ToolCall = {
  name: string
  state: 'running' | 'completed' | 'error'
  input: any
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  description: string | null
  result?: any
  permission?: {...}
}
```

---

## 附录 B: WebSocket 协议对比

| 操作 | 当前项目 | Happy | 改进后 |
|------|---------|-------|--------|
| 发送消息 | `message` | `message` | `message` (保持) |
| 工具状态 | ❌ | `update` (tool) | `update-message` |
| 活动状态 | ❌ | `ephemeral` (activity) | `activity` |
| 会话列表 | `get-conversations` | `sessions` | `conversation-list` |
| 会话状态 | ❌ | `update` (session) | `session-state` |
