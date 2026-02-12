# Bot 代码重构计划

**日期**: 2025-02-11
**状态**: 待执行
**目标**: 系统化修复 src/bot/ 目录中的类型错误和架构问题

---

## 1. 背景

### 1.1 当前问题

**类型错误分析：**
- `src/bot/` 目录有 ~50+ 个 TypeScript 类型错误
- 主要错误类型：
  - `unknown` 类型（block、对象属性访问）
  - 空对象类型 `{}` 缺少属性
  - 缺少类型定义（`ClaudeRawMessage`、`ClaudeRequest`等）
  - any 类型滥用

**架构问题：**
- Bot集成逻辑分散在多个文件中，缺乏统一的数据流管理
- 状态管理不清晰（多个状态变量共存且无明确转换规则）
- 消息格式化逻辑耦合度高，难以测试

### 1.2 重构目标

1. **类型安全** - 消除所有 `any` 类型，建立完整的类型定义
2. **架构清晰** - 重构为清晰的层次结构，数据流单向流动
3. **可测试性** - 建立测试框架，确保重构后功能正确
4. **可维护性** - 代码结构清晰，易于理解和修改

---

## 2. 重构策略：分层渐进修复

### 2.1 重构层次（从底层到上层）

```
第6层：types/operation.ts          类型定义层
第5层：src/bot/tools/          工具函数层
第4层：src/bot/formatters/       消息格式化层
第3层：src/bot/reducer/         状态管理层（核心）
第2层：src/bot/integration/      Claude集成层
第1层：src/components/           UI组件层
```

**修复顺序：** 第6层 → 第5层 → 第4层 → 第3层 → 第2层 → 第1层

### 2.2 各层修复内容

#### 第6层：类型定义层

**文件：** `src/types/operation.ts`

**修复内容：**
1. 补全 Bot 相关类型定义
2. 添加缺失的消息类型（`ClaudeRawMessage`、`ClaudeRequest`等）
3. 修复 `unknown` 类型为具体类型
4. 导出统一的状态类型定义

**新增类型示例：**
```typescript
// Claude 原始消息类型
export interface ClaudeRawMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
  requestId?: string
  status?: 'pending' | 'approved' | 'denied' | 'error'
  error?: string
}

// Claude 请求类型
export interface ClaudeRequest {
  type: 'text' | 'image' | 'tool_use'
  content: string
  timestamp: number
  requestId: string
  context?: {
    maxTokens?: number
    currentCount?: number
  conversationId?: string
  }
}

// WebSocket 连接状态
export type ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  lastError?: string
  serverUrl?: string
  tokenBalance?: number
}

// Bot 状态
export type BotStatus {
  status: 'idle' | 'connecting' | 'active' | 'paused' | 'error'
  currentTool?: string
  activeConversationId?: string
  mode: 'talk' | 'develop'
  lastActivity?: number
}
```

#### 第5层：工具函数层

**文件：** `src/bot/tools/`

**修复内容：**
1. 为所有工具函数添加完整的 JSDoc 注释
2. 修复返回值类型（避免 `unknown`）
3. 添加错误处理逻辑

**新增工具函数示例：**
```typescript
/**
 * 安全地执行命令
 * @param command - 要执行的命令
 * @param args - 命令参数
 * @returns Promise<ExecResult>
 */
export async function execCommand(
  command: string,
  args?: Record<string, string>
): Promise<ExecResult> {
  // 实现...
}

/**
 * 读取文件内容
 * @param filePath - 文件路径
 * @returns Promise<string>
 */
export async function readFile(filePath: string): Promise<string> {
  // 实现...
}
```

#### 第4层：消息格式化层

**文件：** `src/bot/formatters/`

**修复内容：**
1. 提取公共的格式化逻辑到独立函数
2. 为每种消息类型定义专门的 formatter

**新格式化器结构：**
```typescript
// formatters/base.ts
export interface MessageFormatter {
  format(message: ClaudeRawMessage): string
  format(context: { mode: BotStatus }): string
}

// formatters/claude.ts
export class ClaudeMessageFormatter implements MessageFormatter {
  format(message: ClaudeRawMessage): string {
    // Claude 消息格式化
  }
}
```

#### 第3层：状态管理层（核心）

**文件：** `src/bot/reducer/`

**修复内容：**
1. 重新设计状态结构，消除冗余状态变量
2. 实现清晰的 Redux-like reducer 模式
3. 添加状态选择器和中间件

**新状态结构：**
```typescript
// 统一的应用状态
export interface AppState {
  // WebSocket 连接
  connection: ConnectionState
  // 当前对话
  currentConversationId: string | null
  // Bot 状态
  bot: BotStatus
  // 用户信息
  user: {
    id: string
    mode: 'talk' | 'develop'
    permissions: string[]
  }
}

// Reducer
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connection: action.payload }
    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversationId: action.payload }
    case 'SET_BOT_STATUS':
      return { ...state, bot: action.payload }
    // ...
  }
}
```

#### 第2层：Claude 集成层

**文件：** `src/bot/integration/`

**修复内容：**
1. 重构 Claude 集成逻辑，使用新的类型定义
2. 实现 WebSocket 客户端
3. 添加消息处理 pipeline
4. 集成状态管理

**新集成结构：**
```typescript
// integrations/claude/client.ts
export class ClaudeClient {
  private ws: WebSocket
  private handlers: Map<string, (message: ClaudeRawMessage) => void>

  async connect(serverUrl: string): Promise<void>
  async disconnect(): Promise<void>
  on(message: ClaudeRawMessage): void
  send(message: ClaudeRawMessage): Promise<void>
}
```

#### 第1层：UI 组件层

**文件：** `src/components/` 目录下相关组件

**修复内容：**
1. 更新所有 Bot 组件使用新的类型定义
2. 修复组件间的数据传递
3. 确保类型一致性

---

## 3. 测试策略

### 3.1 测试框架

**选择：** Vitest + @testing-library/dom-tools

**理由：**
1. **现代化** - Vitest 是新一代测试框架，性能优于 Jest
2. **原生支持** - 对 ES 模块和 TypeScript 支持更好
3. **UI 测试** - @testing-library/dom-tools 提供强大的组件测试工具
4. **社区成熟** - 生态成熟，文档丰富

### 3.2 测试文件结构

```
tests/
├── unit/                 # 单元测试
│   ├── bot/               # Bot 层测试
│   │   ├── tools/           # 工具函数测试
│   │   ├── formatters/       # 格式化测试
│   │   ├── integration/       # Claude 集成测试
│   └── components/       # UI 组件测试
│   └── e2e/              # E2E 测试（模拟 Electron 环境）
├── integration/          # 集成测试（测试 Claude 连接）
└── fixtures/             # 测试数据和 Mock
```

---

## 4. 实施步骤

### 第一步：准备工作
1. 安装 Vitest 和测试依赖
2. 创建测试配置文件
3. 配置 TypeScript 编译器使用 Vitest

### 第二步：第6层 - 类型定义层
1. 添加完整的 Bot 相关类型定义
2. 修复 `unknown` 类型问题
3. 导出统一类型

### 第三步：第5层 - 工具函数层
1. 为所有工具函数添加 JSDoc
2. 修复返回值类型
3. 编写工具函数单元测试

### 第四步：第4层 - 消息格式化层
1. 提取公共格式化逻辑
2. 为每种消息类型创建专门的 formatter
3. 编写格式化器单元测试

### 第五步：第3层 - 状态管理层（核心）
1. 重新设计应用状态结构
2. 实现 Redux-like reducer
3. 编写状态管理单元测试
4. 编写集成测试

### 第六步：第2层 - Claude 集成层
1. 使用新类型定义重构 Claude 集成逻辑
2. 实现 WebSocket 客户端
3. 编写集成测试

### 第七步：第1层 - UI 组件层
1. 更新所有 Bot 相关组件
2. 确保数据传递类型正确
3. 编写组件集成测试

### 第八步：配置测试环境
1. 更新 package.json
2. 配置 Vitest
3. 添加测试脚本

### 第九步：编写测试
1. 为每个层编写充分的单元测试
2. 覆盖率和关键路径
3. UI 组件快照测试

### 第十步：运行测试
1. 执行 Vitest
2. 查看覆盖率报告
3. 修复失败的测试

---

## 5. 风险控制

### 5.1 风险识别

**技术风险：**
1. 类型系统大规模改动可能引入新 bug
2. 重构过程中现有功能可能受影响
3. 测试框架配置复杂

**缓解措施：**
1. 分层渐进修复，每层修复后立即测试
2. 为关键模块编写充分测试
3. 保留现有功能，只重构不删除
4. 建立特性分支进行重构
5. Code Review 每层修复

### 5.2 回滚计划

如果重构导致严重问题：
1. **Git 回滚** - 保留重构前的干净状态
2. **功能分支** - 在功能分支上进行重构，主分支保持稳定

---

## 6. 预期效果

### 6.1 预期改进

**类型安全：**
- 消除所有 `any` 类型
- 完整的类型定义覆盖所有场景
- 编译器类型检查确保类型安全

**代码质量：**
- 清晰的模块层次结构
- 统一的状态管理（Redux-like reducer）
- 完善的错误处理和日志系统

**测试覆盖：**
- Vitest 单元测试覆盖核心逻辑
- UI 组件快照测试
- 集成测试验证端到端通信

**可维护性：**
- 清晰的代码结构
- 完善的类型系统
- 充分的文档和注释

---

## 7. 时间估算

### 7.1 工作量估算

**修复内容：**
- 第6层（类型定义）：2-3 天
- 第5层（工具函数）：3-4 天
- 第4层（格式化）：2-3 天
- 第3层（状态管理）：5-7 天
- 第2层（Claude集成）：4-6 天
- 第1层（UI组件）：3-4 天

**总计：** 约 20-30 工作日

### 7.2 里程碑

1. **Day 3-5** - 类型定义层完成，工具函数层修复开始
2. **Day 7-9** - 工具函数和格式化层完成，状态管理层重构开始
3. **Day 12-16** - Claude 集成层完成，UI 层更新开始
4. **Day 16-20** - 测试框架配置完成，开始编写测试
5. **Day 20-22** - 所有测试完成，覆盖率 > 80%

---

## 8. 验收标准

### 8.1 类型安全
- [ ] 消除所有 `any` 类型
- [ ] 所有函数有明确的参数和返回值类型
- [ ] 使用类型守卫确保运行时安全

### 8.2 代码质量
- [ ] 代码结构清晰，模块职责明确
- [ ] 遵循单一职责原则
- [ ] 消除循环依赖和重复代码

### 8.3 测试覆盖
- [ ] 核心逻辑覆盖率 > 80%
- [ ] UI 组件有快照测试
- [ ] 集成测试验证端到端通信

### 8.4 功能完整性
- [ ] 所有现有功能正常工作
- [ ] 新的测试框架正常运行
- [ ] 重构过程中无功能丢失

---

## 9. 后续优化

### 9.1 短期优化（重构后）

**性能优化：**
1. 实现 React.memo 优化渲染性能
2. 虚拟滚动优化
3. 懒加载和代码分割

**架构演进：**
1. 考虑引入状态机（Zustand、Redux）统一管理复杂状态
2. 实现 React Query 优化大量列表渲染

---

**附录：**

**A. 新增类型定义文件结构**
```
src/types/bot/
├── index.ts              # 统一导出
├── claude.ts             # Claude 相关类型
├── connection.ts          # WebSocket 连接
├── messages.ts            # 消息类型
├── state.ts             # 应用状态
└── index.ts             # 回退到原有导出
```

**B. 测试配置示例**
```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**'],
    coverage: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
})
```

---

**计划状态：** ✅ 已完成所有关键决策
**下一步：** 等待用户确认后开始执行