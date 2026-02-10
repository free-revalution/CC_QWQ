# CC QwQ Phase 2: 消息处理架构设计

**基于 Happy 的设计思想**

**日期**: 2025-02-10  
**状态**: 设计中

---

## 1. 核心设计原则

### 1.1 从 Happy 学到的关键思想

| Happy 设计 | CC QwQ 应用 |
|------------|-------------|
| 分阶段 Reducer 处理 | 消息分阶段处理（权限→文本→工具→结果） |
| 扁平化消息类型 | 每条消息代表单一内容块 |
| 工具调用包含子消息 | 支持嵌套对话（Task 工具） |
| 权限与工具关联 | permissionId = toolId 匹配机制 |
| 工具视图注册系统 | 每个工具有专门的显示组件 |
| 消息去重机制 | localId + messageId + permissionId 三重跟踪 |

### 1.2 CC QwQ 特殊考虑

**与 Happy 的区别**：
- Happy 是移动端 App，CC QwQ 是聊天 Bot
- 显示限制：聊天消息有长度限制
- 交互限制：聊天不能显示复杂 UI
- 上下文限制：需要更智能的摘要和过滤

**设计适应**：
- 长输出 → 摘要 + "查看详情"命令
- 复杂工具 → 引导到桌面端
- 文件操作 → 特殊处理和通知

---

## 2. 消息类型系统

### 2.1 核心消息类型

```typescript
// electron_app/src/bot/types/messages.ts

export type BotMessageKind = 
  | 'user-text'        // 用户消息
  | 'agent-text'       // AI 文本回复
  | 'tool-call'        // 工具调用
  | 'tool-result'      // 工具结果
  | 'permission'       // 权限请求
  | 'event'           // 系统事件
  | 'error';          // 错误消息

export interface BaseMessage {
  id: string;
  kind: BotMessageKind;
  timestamp: number;
  platform: 'whatsapp' | 'feishu';
  conversationId: string;
}

export interface UserTextMessage extends BaseMessage {
  kind: 'user-text';
  content: string;
  displayText?: string;  // 可选的显示文本
}

export interface AgentTextMessage extends BaseMessage {
  kind: 'agent-text';
  content: string;
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    tokensUsed?: number;
  };
}

export interface ToolCallMessage extends BaseMessage {
  kind: 'tool-call';
  tool: {
    name: string;
    state: 'running' | 'completed' | 'error';
    input: any;
    description?: string;
    startedAt?: number;
  };
  permission?: {
    id: string;
    status: 'pending' | 'approved' | 'denied';
  };
  // 简化显示（聊天中）
  summary?: string;
  // 详细数据（桌面端可用）
  fullData?: any;
}

export interface ToolResultMessage extends BaseMessage {
  kind: 'tool-result';
  toolUseId: string;
  result: any;
  isError?: boolean;
  summary?: string;  // 聊天中显示的摘要
}

export interface PermissionMessage extends BaseMessage {
  kind: 'permission';
  permission: {
    id: string;
    toolName: string;
    input: any;
    status: 'pending' | 'approved' | 'denied';
    reason?: string;
  };
  actions?: string[];  // 可用命令：/approve, /deny
}

export interface EventMessage extends BaseMessage {
  kind: 'event';
  event: {
    type: 'ready' | 'mode_switch' | 'context_reset' | 'compaction';
    data?: any;
  };
}

export type Message = 
  | UserTextMessage 
  | AgentTextMessage 
  | ToolCallMessage 
  | ToolResultMessage 
  | PermissionMessage 
  | EventMessage;
```

---

## 3. 消息 Reducer 系统

### 3.1 Reducer 状态

```typescript
// electron_app/src/bot/reducer/types.ts

export interface ReducerState {
  // 消息跟踪（去重）
  localIds: Map<string, string>;     // localId -> messageId
  messageIds: Map<string, string>;    // messageId -> messageId
  
  // 权限和工具关联
  toolIdToMessageId: Map<string, string>;  // toolId/permissionId -> messageId
  pendingPermissions: Map<string, PermissionData>;
  
  // 侧链（子对话）
  sidechains: Map<string, Message[]>;  // toolId -> 子消息数组
  
  // 当前状态
  messages: Map<string, Message>;
  currentConversation?: string;
  
  // 指标
  metrics: {
    messagesProcessed: number;
    errors: number;
    lastUpdate: number;
  };
}

export interface PermissionData {
  toolName: string;
  input: any;
  createdAt: number;
  status: 'pending' | 'approved' | 'denied';
}
```

### 3.2 Reducer 处理阶段

```typescript
// electron_app/src/bot/reducer/reducer.ts

export function messageReducer(
  state: ReducerState,
  rawMessages: ClaudeRawMessage[],
  agentState?: AgentState
): ReducerResult {
  
  // Phase 0: 处理权限请求
  // - 从 agentState 获取待处理权限
  // - 创建权限占位消息
  
  // Phase 1: 处理用户消息和 AI 文本
  // - 去重检查
  // - 创建文本消息
  
  // Phase 2: 处理工具调用
  // - 匹配到权限消息（如果存在）
  // - 创建或更新工具消息
  
  // Phase 3: 处理工具结果
  // - 更新工具状态
  // - 生成摘要（用于聊天显示）
  
  // Phase 4: 处理侧链
  // - 识别 Task 等工具的子对话
  // - 存储到 sidechains
  
  // Phase 5: 处理事件
  // - ready, mode_switch 等
  
  return {
    newMessages: Message[],
    permissions: PermissionMessage[],
    hasChanges: boolean
  };
}
```

---

## 4. 聊天消息格式化策略

### 4.1 消息长度限制

| 平台 | 消息限制 | 策略 |
|------|---------|------|
| WhatsApp | ~4096 字符 | 摘要 + 截断 |
| 飞书 | ~10000 字符 | 较完整显示 |

### 4.2 格式化规则

**AI 文本消息**：
```
🤖 [AI 思考中...]

━━━━━━━━━━━━━━
[完整回复内容]
━━━━━━━━━━━━━━

✅ 完成 | 模型: claude-opus-4-5 | 用时: 12s
```

**工具调用（简洁版）**：
```
🔧 Bash: git status

运行中... [12s]

✅ 完成
[简要输出摘要]
```

**权限请求**：
```
🔔 权限请求

工具: bash:execute
命令: git status

回复 /approve 批准
回复 /deny 拒绝
```

**工具结果（长输出）**：
```
📊 Bash 结果

[前 500 字符摘要...]

┌────────────────────┐
│ 输出过长 (2340 字符)  │
│ 回复 /full 查看完整输出 │
└────────────────────┘
```

---

## 5. 上下文和对话管理

### 5.1 对话识别

```typescript
// electron_app/src/bot/context/types.ts

export interface ConversationContext {
  id: string;
  projectPath: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  
  // 上下文摘要
  summary?: string;
  recentTools?: string[];  // 最近使用的工具
  
  // 限制
  maxMessages?: number;
  maxContextTokens?: number;
}

export interface ConversationManager {
  // 获取当前对话
  getCurrent(): ConversationContext | null;
  
  // 切换对话
  switch(conversationId: string): Promise<void>;
  
  // 创建新对话
  create(projectPath: string): ConversationContext;
  
  // 获取对话历史（摘要版）
  getHistory(conversationId: string, limit?: number): MessageSummary[];
}
```

### 5.2 多 Agent/MCPSession 支持

```typescript
// 识别策略
export function detectMessageType(content: any): MessageType {
  // 检查是否是 MCP 工具调用
  if (content.serverName) return 'mcp-tool';
  
  // 检查是否是技能调用
  if (content.skillName) return 'skill-call';
  
  // 检查是否是 Task 工具（子代理）
  if (content.toolName === 'Task') return 'subagent';
  
  // 普通工具调用
  if (content.type === 'tool-call') return 'tool-call';
  
  return 'text';
}
```

---

## 6. 工具视图注册系统

### 6.1 视图注册表

```typescript
// electron_app/src/bot/tools/registry.ts

export interface ToolViewFormatter {
  // 为聊天生成简要显示
  formatSummary(tool: ToolCall): string;
  
  // 为聊天生成状态更新
  formatStateChange(tool: ToolCall): string;
  
  // 生成详细输出（用于桌面端或 /full 命令）
  formatDetail(tool: ToolCall): string;
  
  // 判断是否需要特殊处理
  needsDesktopHandling?(tool: ToolCall): boolean;
}

export const toolViewRegistry: Record<string, ToolViewFormatter> = {
  'bash:execute': {
    formatSummary: (tool) => `🔧 Bash: ${tool.input.command}`,
    formatStateChange: (tool) => {
      if (tool.state === 'running') return `⏳ 运行中...`;
      if (tool.state === 'completed') return `✅ 完成`;
      if (tool.state === 'error') return `❌ 错误`;
    },
    formatDetail: (tool) => {
      // 完整输出，包括 exit code, stdout, stderr
    }
  },
  
  'str_replace_editor': {
    formatSummary: (tool) => `📝 Edit: ${tool.input.path}`,
    // ...
  },
  
  'TodoWrite': {
    formatSummary: (tool) => `📋 任务列表更新`,
    formatDetail: (tool) => {
      // 格式化 todo 列表
    }
  },
  
  'Task': {
    formatSummary: (tool) => `🎯 子任务启动`,
    needsDesktopHandling: (tool) => true,  // 复杂，建议桌面端
    formatDetail: (tool) => {
      // 显示子对话摘要
    }
  },
  
  // MCP 工具通用处理
  '_mcp_tool': {
    formatSummary: (tool) => `🔌 MCP: ${tool.serverName}.${tool.name}`,
    // ...
  }
};
```

### 6.2 动态视图选择

```typescript
export function getToolFormatter(toolName: string): ToolViewFormatter {
  // 精确匹配
  if (toolViewRegistry[toolName]) {
    return toolViewRegistry[toolName];
  }
  
  // MCP 工具匹配
  if (toolName.includes('/')) {
    return toolViewRegistry['_mcp_tool'];
  }
  
  // 默认格式化器
  return toolViewRegistry['_default'];
}
```

---

## 7. 实施路线图

### Phase 2.1: 消息类型系统 ✅
- [ ] 创建 `types/messages.ts`
- [ ] 创建 `types/reducer.ts`
- [ ] 创建 `types/context.ts`
- [ ] 单元测试

### Phase 2.2: 消息 Reducer
- [ ] 实现 `reducer.ts` 核心逻辑
- [ ] 实现去重机制
- [ ] 实现权限匹配
- [ ] 实现侧链处理
- [ ] 单元测试

### Phase 2.3: 工具格式化器
- [ ] 创建工具注册表
- [ ] 实现核心工具格式化器
  - [ ] Bash
  - [ ] Edit/Write
  - [ ] TodoWrite
  - [ ] Task
- [ ] 实现通用 MCP 格式化器

### Phase 2.4: 聊天消息格式化
- [ ] 创建 `formatters/chat.ts`
- [ ] 实现消息长度适配
- [ ] 实现摘要生成
- [ ] 实现 /full 命令支持

### Phase 2.5: Claude Code IPC 集成
- [ ] 扩展 IPC 接口
- [ ] 实现消息监听器
- [ ] 实现 Reducer 与 Claude Code 集成
- [ ] 集成测试

---

**预计工期**: Phase 2 总共 4-6 周

**下一步**: 开始 Phase 2.1 - 创建消息类型系统
