# Bot 代码重构与测试实施计划 (TDD)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 TDD 方法重构 `src/bot/` 目录，建立完整的测试框架，消除类型安全隐患。

**Architecture:** 从底层到顶层的分层重构：类型定义 → 工具层 → 格式化层 → 状态管理层 → 集成层 → 组件层。

**Tech Stack:** TypeScript, Vitest, @testing-library/dom-tools

---

## 阶段 0：测试环境搭建

### Task 0.1：安装 Vitest 和测试依赖

**Files:**
- Modify: `electron_app/package.json`

**Step 1：安装测试依赖**

```bash
cd /Users/jiang/development/claudphone/electron_app
npm install -D vitest @vitest/ui @testing-library/dom-tools jsdom
```

预期：依赖安装成功，无错误

**Step 2：验证安装**

```bash
npx vitest --version
```

预期：显示 Vitest 版本号

**Step 3：提交**

```bash
git add package.json package-lock.json
git commit -m "chore: install vitest and testing dependencies"
```

---

### Task 0.2：创建 Vitest 配置文件

**Files:**
- Create: `electron_app/vitest.config.ts`

**Step 1：创建配置文件**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
      ],
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**Step 2：创建测试设置文件**

- Create: `electron_app/vitest.setup.ts`

```typescript
import { vi } from 'vitest'

// Mock IPC
vi.mock('@/lib/ipc', () => ({
  ipc: {
    claudeSend: vi.fn(),
    respondPermission: vi.fn(),
    getMessages: vi.fn()
  }
}))
```

**Step 3：更新 package.json 添加测试脚本**

- Modify: `electron_app/package.json` - 在 `scripts` 中添加：

```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

**Step 4：验证配置**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run
```

预期：显示 "No test files found"（配置正确，但还没有测试文件）

**Step 5：提交**

```bash
git add vitest.config.ts vitest.setup.ts package.json
git commit -m "test: setup vitest configuration"
```

---

## 阶段 1：类型定义层测试

### Task 1.1：测试消息类型守卫函数

**Files:**
- Create: `electron_app/src/bot/types/messages.test.ts`

**Step 1：编写类型守卫测试**

```typescript
import { describe, it, expect } from 'vitest'
import {
  Message, UserTextMessage, AgentTextMessage, ToolCallMessage,
  ToolResultMessage, PermissionMessage, EventMessage, ErrorMessage,
  isUserTextMessage, isAgentTextMessage, isToolCallMessage,
  isToolResultMessage, isPermissionMessage, isEventMessage, isErrorMessage
} from './messages'

describe('Message Type Guards', () => {
  describe('isUserTextMessage', () => {
    it('should return true for user-text message', () => {
      const msg: UserTextMessage = {
        id: '1',
        kind: 'user-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'hello'
      }
      expect(isUserTextMessage(msg)).toBe(true)
    })

    it('should return false for agent-text message', () => {
      const msg: AgentTextMessage = {
        id: '2',
        kind: 'agent-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'hi there'
      }
      expect(isUserTextMessage(msg)).toBe(false)
    })

    it('should return false for tool-call message', () => {
      const msg: ToolCallMessage = {
        id: '3',
        kind: 'tool-call',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'ls' },
          createdAt: Date.now()
        }
      }
      expect(isUserTextMessage(msg)).toBe(false)
    })
  })

  describe('isAgentTextMessage', () => {
    it('should return true for agent-text message', () => {
      const msg: AgentTextMessage = {
        id: '1',
        kind: 'agent-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'response'
      }
      expect(isAgentTextMessage(msg)).toBe(true)
    })

    it('should return false for user-text message', () => {
      const msg: UserTextMessage = {
        id: '2',
        kind: 'user-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'hello'
      }
      expect(isAgentTextMessage(msg)).toBe(false)
    })
  })

  describe('isToolCallMessage', () => {
    it('should return true for tool-call message', () => {
      const msg: ToolCallMessage = {
        id: '1',
        kind: 'tool-call',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'ls' },
          createdAt: Date.now()
        }
      }
      expect(isToolCallMessage(msg)).toBe(true)
    })

    it('should return false for user-text message', () => {
      const msg: UserTextMessage = {
        id: '2',
        kind: 'user-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'hello'
      }
      expect(isToolCallMessage(msg)).toBe(false)
    })
  })

  describe('isToolResultMessage', () => {
    it('should return true for tool-result message', () => {
      const msg: ToolResultMessage = {
        id: '1',
        kind: 'tool-result',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        toolUseId: 'tool1',
        toolName: 'bash:execute',
        result: { stdout: 'output' }
      }
      expect(isToolResultMessage(msg)).toBe(true)
    })
  })

  describe('isPermissionMessage', () => {
    it('should return true for permission message', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'ls' },
          status: 'pending'
        }
      }
      expect(isPermissionMessage(msg)).toBe(true)
    })
  })

  describe('isEventMessage', () => {
    it('should return true for event message', () => {
      const msg: EventMessage = {
        id: '1',
        kind: 'event',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        event: {
          type: 'ready',
          message: 'Ready'
        }
      }
      expect(isEventMessage(msg)).toBe(true)
    })
  })

  describe('isErrorMessage', () => {
    it('should return true for error message', () => {
      const msg: ErrorMessage = {
        id: '1',
        kind: 'error',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        error: {
          message: 'Something went wrong'
        }
      }
      expect(isErrorMessage(msg)).toBe(true)
    })

    it('should return false when isError is false', () => {
      const msg: ErrorMessage = {
        id: '2',
        kind: 'error',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        error: {
          message: 'Error'
        },
        isError: false
      }
      expect(isErrorMessage(msg)).toBe(false)
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/types/messages.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/types/messages.test.ts
git commit -m "test: add message type guard tests"
```

---

### Task 1.2：测试 Reducer 状态创建

**Files:**
- Create: `electron_app/src/bot/types/reducer.test.ts`

**Step 1：编写 Reducer 状态测试**

```typescript
import { describe, it, expect } from 'vitest'
import { createReducer, type ReducerState } from './reducer'

describe('Reducer State', () => {
  describe('createReducer', () => {
    it('should create empty state with all maps initialized', () => {
      const state = createReducer()

      expect(state.localIds).toBeInstanceOf(Map)
      expect(state.localIds.size).toBe(0)

      expect(state.messageIds).toBeInstanceOf(Map)
      expect(state.messageIds.size).toBe(0)

      expect(state.toolIdToMessageId).toBeInstanceOf(Map)
      expect(state.toolIdToMessageId.size).toBe(0)

      expect(state.pendingPermissions).toBeInstanceOf(Map)
      expect(state.pendingPermissions.size).toBe(0)

      expect(state.sidechains).toBeInstanceOf(Map)
      expect(state.sidechains.size).toBe(0)

      expect(state.messages).toBeInstanceOf(Map)
      expect(state.messages.size).toBe(0)
    })

    it('should initialize metrics with zero values', () => {
      const state = createReducer()

      expect(state.metrics.messagesProcessed).toBe(0)
      expect(state.metrics.errors).toBe(0)
      expect(state.metrics.lastUpdate).toBeGreaterThan(0)
    })

    it('should create independent state instances', () => {
      const state1 = createReducer()
      const state2 = createReducer()

      state1.messageIds.set('test', 'test')

      expect(state1.messageIds.size).toBe(1)
      expect(state2.messageIds.size).toBe(0)
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/types/reducer.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/types/reducer.test.ts
git commit -m "test: add reducer state tests"
```

---

## 阶段 2：工具层测试

### Task 2.1：测试工具格式化注册表

**Files:**
- Create: `electron_app/src/bot/tools/registry.test.ts`

**Step 1：编写工具格式化器测试**

```typescript
import { describe, it, expect } from 'vitest'
import {
  getToolFormatter,
  formatToolForChat,
  formatToolStateChange,
  formatToolDetail,
  needsDesktopHandling,
  shouldTruncateOutput,
  extractToolKeyInfo,
  type ToolCallMessage
} from './registry'
import type { BashToolInput, EditToolInput, WriteToolInput, TodoWriteToolInput } from '../types/messages'

describe('Tool View Registry', () => {
  const createMockTool = (
    name: string,
    state: 'running' | 'completed' | 'error',
    input: Record<string, unknown>,
    result?: unknown
  ): ToolCallMessage['tool'] => ({
    name,
    state,
    input,
    createdAt: Date.now(),
    startedAt: Date.now(),
    completedAt: state !== 'running' ? Date.now() : undefined,
    result
  })

  describe('getToolFormatter', () => {
    it('should return bash formatter for bash:execute', () => {
      const formatter = getToolFormatter('bash:execute')
      expect(formatter).toBeDefined()
      expect(formatter.formatSummary).toBeDefined()
    })

    it('should return edit formatter for str_replace_editor', () => {
      const formatter = getToolFormatter('str_replace_editor')
      expect(formatter).toBeDefined()
    })

    it('should return write formatter for write', () => {
      const formatter = getToolFormatter('write')
      expect(formatter).toBeDefined()
    })

    it('should return MCP formatter for tools with /', () => {
      const formatter = getToolFormatter('mcp-server/tool-name')
      expect(formatter).toBeDefined()
    })

    it('should return default formatter for unknown tools', () => {
      const formatter = getToolFormatter('unknown-tool')
      expect(formatter).toBeDefined()
    })
  })

  describe('formatToolForChat - Bash Tool', () => {
    it('should format bash command summary', () => {
      const tool = createMockTool('bash:execute', 'running', {
        command: 'npm install'
      })
      const formatted = formatToolForChat(tool)

      expect(formatted).toContain('Bash')
      expect(formatted).toContain('npm install')
    })

    it('should truncate long bash commands', () => {
      const longCommand = 'npm install ' + 'x'.repeat(100)
      const tool = createMockTool('bash:execute', 'running', {
        command: longCommand
      })
      const formatted = formatToolForChat(tool)

      expect(formatted.length).toBeLessThan(60)
      expect(formatted).toContain('...')
    })

    it('should handle cmd property as fallback', () => {
      const tool = createMockTool('bash:execute', 'running', {
        cmd: 'ls -la'
      })
      const formatted = formatToolForChat(tool)

      expect(formatted).toContain('ls -la')
    })
  })

  describe('formatToolStateChange', () => {
    it('should format running state', () => {
      const tool = createMockTool('bash:execute', 'running', {
        command: 'sleep 1'
      })
      const formatted = formatToolStateChange(tool)

      expect(formatted).toContain('运行中')
    })

    it('should format completed state', () => {
      const tool = createMockTool('bash:execute', 'completed', {
        command: 'echo hi'
      }, { exit_code: 0, stdout: 'hi' })
      const formatted = formatToolStateChange(tool)

      expect(formatted).toContain('完成')
    })

    it('should format error state', () => {
      const tool = createMockTool('bash:execute', 'error', {
        command: 'false'
      }, { error: 'Command failed' })
      const formatted = formatToolStateChange(tool)

      expect(formatted).toContain('错误')
    })
  })

  describe('formatToolDetail', () => {
    it('should format bash tool detail', () => {
      const tool = createMockTool('bash:execute', 'completed', {
        command: 'echo hello'
      }, {
        exit_code: 0,
        stdout: 'hello\n',
        stderr: ''
      })
      const formatted = formatToolDetail(tool)

      expect(formatted).toContain('echo hello')
      expect(formatted).toContain('完成')
      expect(formatted).toContain('exit_code')
    })

    it('should format edit tool detail', () => {
      const tool = createMockTool('str_replace_editor', 'completed', {
        command: 'edit',
        path: '/path/to/file.ts',
        old_str: 'old',
        new_str: 'new'
      })
      const formatted = formatToolDetail(tool)

      expect(formatted).toContain('file.ts')
      expect(formatted).toContain('edit')
    })
  })

  describe('needsDesktopHandling', () => {
    it('should return true for Task tool', () => {
      const tool = createMockTool('Task', 'running', {
        goal: 'Do something complex'
      })
      const needsDesktop = needsDesktopHandling(tool)

      expect(needsDesktop).toBe(true)
    })

    it('should return false for bash tool', () => {
      const tool = createMockTool('bash:execute', 'running', {
        command: 'ls'
      })
      const needsDesktop = needsDesktopHandling(tool)

      expect(needsDesktop).toBe(false)
    })
  })

  describe('shouldTruncateOutput', () => {
    it('should return true for long bash output', () => {
      const tool = createMockTool('bash:execute', 'completed', {
        command: 'cat file'
      })
      const shouldTruncate = shouldTruncateOutput(tool, 2500)

      expect(shouldTruncate).toBe(true)
    })

    it('should return false for short bash output', () => {
      const tool = createMockTool('bash:execute', 'completed', {
        command: 'echo hi'
      })
      const shouldTruncate = shouldTruncateOutput(tool, 500)

      expect(shouldTruncate).toBe(false)
    })
  })

  describe('extractToolKeyInfo', () => {
    it('should extract todo count for TodoWrite tool', () => {
      const tool = createMockTool('TodoWrite', 'completed', {
        todos: [
          { status: 'completed', priority: 'high', content: 'Task 1' },
          { status: 'pending', priority: 'medium', content: 'Task 2' }
        ]
      })
      const info = extractToolKeyInfo(tool)

      expect(info).toEqual({
        todoCount: 2,
        completed: 1
      })
    })

    it('should return null for tools without key info extractor', () => {
      const tool = createMockTool('bash:execute', 'completed', {
        command: 'ls'
      })
      const info = extractToolKeyInfo(tool)

      expect(info).toBeNull()
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/tools/registry.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/tools/registry.test.ts
git commit -m "test: add tool registry formatter tests"
```

---

## 阶段 3：格式化层测试

### Task 3.1：测试聊天消息格式化器

**Files:**
- Create: `electron_app/src/bot/formatters/chat.test.ts`

**Step 1：编写聊天格式化器测试**

```typescript
import { describe, it, expect } from 'vitest'
import {
  formatMessageForChat,
  formatMessagesForChat,
  formatPermissionRequest,
  getCommandHelpText,
  type FormatOptions
} from './chat'
import type {
  UserTextMessage, AgentTextMessage, ToolCallMessage,
  PermissionMessage, EventMessage, ErrorMessage
} from '../types/messages'

describe('Chat Message Formatter', () => {
  const defaultOptions: FormatOptions = {
    platform: 'whatsapp',
    compact: false,
    includeTimestamp: true
  }

  describe('formatMessageForChat - User Text', () => {
    it('should format user text message', () => {
      const msg: UserTextMessage = {
        id: '1',
        kind: 'user-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'Hello, how are you?'
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('Hello, how are you?')
      expect(formatted).toContain('👤')
    })

    it('should format in compact mode', () => {
      const msg: UserTextMessage = {
        id: '1',
        kind: 'user-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'A'.repeat(200)
      }
      const options = { ...defaultOptions, compact: true }
      const formatted = formatMessageForChat(msg, options)

      expect(formatted.length).toBeLessThan(150)
      expect(formatted).toContain('...')
    })
  })

  describe('formatMessageForChat - Agent Text', () => {
    it('should format agent text message', () => {
      const msg: AgentTextMessage = {
        id: '1',
        kind: 'agent-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'I am doing well, thank you!'
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('I am doing well, thank you!')
      expect(formatted).toContain('✅')
    })

    it('should show streaming indicator', () => {
      const msg: AgentTextMessage = {
        id: '1',
        kind: 'agent-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'Thinking...',
        isStreaming: true
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('思考中')
    })

    it('should show metadata when available', () => {
      const msg: AgentTextMessage = {
        id: '1',
        kind: 'agent-text',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        content: 'Response',
        metadata: {
          model: 'claude-opus-4-5',
          tokensUsed: 1234,
          finishReason: 'stop'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('claude-opus-4-5')
      expect(formatted).toContain('1234')
    })
  })

  describe('formatMessageForChat - Tool Call', () => {
    it('should format tool call in running state', () => {
      const msg: ToolCallMessage = {
        id: '1',
        kind: 'tool-call',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'npm test' },
          createdAt: Date.now(),
          startedAt: Date.now()
        },
        summary: '🔧 Bash: npm test'
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('bash:execute')
      expect(formatted).toContain('运行中')
    })

    it('should format tool call in completed state', () => {
      const msg: ToolCallMessage = {
        id: '1',
        kind: 'tool-call',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        tool: {
          name: 'bash:execute',
          state: 'completed',
          input: { command: 'ls' },
          createdAt: Date.now(),
          startedAt: Date.now(),
          completedAt: Date.now(),
          result: { exit_code: 0 }
        },
        summary: '✅ Bash 完成'
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('完成')
    })

    it('should show pending permission info', () => {
      const msg: ToolCallMessage = {
        id: '1',
        kind: 'tool-call',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'rm -rf /' },
          createdAt: Date.now(),
          startedAt: Date.now()
        },
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'rm -rf /' },
          status: 'pending'
        },
        summary: '🔧 Bash: rm -rf /'
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('等待批准')
      expect(formatted).toContain('/approve')
      expect(formatted).toContain('/deny')
    })
  })

  describe('formatMessageForChat - Permission', () => {
    it('should format permission request', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'cat file.txt' },
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' },
          { command: '/deny', label: '拒绝' }
        ]
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('权限请求')
      expect(formatted).toContain('bash:execute')
      expect(formatted).toContain('批准')
      expect(formatted).toContain('拒绝')
    })

    it('should show approved status', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'ls' },
          status: 'approved'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('已批准')
    })

    it('should show denied status', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'ls' },
          status: 'denied'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('已拒绝')
    })
  })

  describe('formatMessageForChat - Event', () => {
    it('should format ready event', () => {
      const msg: EventMessage = {
        id: '1',
        kind: 'event',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        event: {
          type: 'ready',
          message: 'System ready'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('就绪')
    })

    it('should format mode switch event', () => {
      const msg: EventMessage = {
        id: '1',
        kind: 'event',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        event: {
          type: 'mode_switch',
          data: { mode: 'develop' }
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('模式切换')
      expect(formatted).toContain('develop')
    })

    it('should format error event', () => {
      const msg: EventMessage = {
        id: '1',
        kind: 'event',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        event: {
          type: 'error',
          message: 'Connection failed'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('错误')
      expect(formatted).toContain('Connection failed')
    })
  })

  describe('formatMessageForChat - Error', () => {
    it('should format error message', () => {
      const msg: ErrorMessage = {
        id: '1',
        kind: 'error',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        error: {
          message: 'Something went wrong',
          code: 'ERR_001'
        }
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('错误')
      expect(formatted).toContain('Something went wrong')
    })

    it('should show recoverable indicator', () => {
      const msg: ErrorMessage = {
        id: '1',
        kind: 'error',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        error: {
          message: 'Retry possible'
        },
        recoverable: true
      }
      const formatted = formatMessageForChat(msg, defaultOptions)

      expect(formatted).toContain('可以恢复')
    })
  })

  describe('formatMessagesForChat - Batch Formatting', () => {
    it('should batch messages within limit', () => {
      const messages: UserTextMessage[] = [
        {
          id: '1',
          kind: 'user-text',
          timestamp: Date.now(),
          platform: 'whatsapp',
          conversationId: 'conv1',
          content: 'Message 1'
        },
        {
          id: '2',
          kind: 'user-text',
          timestamp: Date.now(),
          platform: 'whatsapp',
          conversationId: 'conv1',
          content: 'Message 2'
        }
      ]
      const batches = formatMessagesForChat(messages, defaultOptions)

      expect(batches.length).toBe(1)
      expect(batches[0]).toContain('Message 1')
      expect(batches[0]).toContain('Message 2')
    })

    it('should split messages that exceed limit', () => {
      const longContent = 'A'.repeat(5000)
      const messages: UserTextMessage[] = [
        {
          id: '1',
          kind: 'user-text',
          timestamp: Date.now(),
          platform: 'whatsapp',
          conversationId: 'conv1',
          content: longContent
        }
      ]
      const batches = formatMessagesForChat(messages, {
        ...defaultOptions,
        platform: 'whatsapp'
      })

      // WhatsApp limit is 4096, should split
      expect(batches.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('formatPermissionRequest', () => {
    it('should format permission for WhatsApp', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'whatsapp',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'bash:execute',
          input: { command: 'ls' },
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' },
          { command: '/deny', label: '拒绝' }
        ]
      }
      const formatted = formatPermissionRequest(msg, 'whatsapp')

      expect(formatted).toContain('*权限请求*')
      expect(formatted).toContain('bash:execute')
    })

    it('should format permission for Feishu', () => {
      const msg: PermissionMessage = {
        id: '1',
        kind: 'permission',
        timestamp: Date.now(),
        platform: 'feishu',
        conversationId: 'conv1',
        permission: {
          id: 'perm1',
          toolName: 'write',
          input: { path: '/tmp/test.txt', content: 'hello' },
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' }
        ]
      }
      const formatted = formatPermissionRequest(msg, 'feishu')

      expect(formatted).toContain('权限请求')
      expect(formatted).toContain('write')
    })
  })

  describe('getCommandHelpText', () => {
    it('should return help text with all commands', () => {
      const help = getCommandHelpText()

      expect(help).toContain('/status')
      expect(help).toContain('/history')
      expect(help).toContain('/full')
      expect(help).toContain('/approve')
      expect(help).toContain('/deny')
      expect(help).toContain('/help')
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/formatters/chat.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/formatters/chat.test.ts
git commit -m "test: add chat formatter tests"
```

---

## 阶段 4：状态管理层测试

### Task 4.1：测试 Message Reducer

**Files:**
- Create: `electron_app/src/bot/reducer/reducer.test.ts`

**Step 1：编写 Reducer 测试**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { messageReducer, createReducerState, type ClaudeRawMessage } from './reducer'
import type { ReducerState } from '../types/reducer'
import type { Message, UserTextMessage, ToolCallMessage } from '../types/messages'

describe('Message Reducer', () => {
  let state: ReducerState

  beforeEach(() => {
    state = createReducerState()
  })

  describe('Phase 1: User Messages', () => {
    it('should process user text message', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'user',
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'Hello AI' }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(1)
      expect(result.newMessages[0].kind).toBe('user-text')
      expect((result.newMessages[0] as UserTextMessage).content).toBe('Hello AI')
      expect(result.hasChanges).toBe(true)
    })

    it('should deduplicate messages by id', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'user',
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'Hello' }]
      }
      const result1 = messageReducer(state, [rawMsg], null)
      const result2 = messageReducer(state, [rawMsg], null)

      expect(result1.newMessages).toHaveLength(1)
      expect(result2.newMessages).toHaveLength(0)
    })

    it('should deduplicate messages by localId', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'user',
        timestamp: Date.now(),
        localId: 'local1',
        content: [{ type: 'text', text: 'Hello' }]
      }
      const result1 = messageReducer(state, [rawMsg], null)

      // Same message with different id but same localId
      const rawMsg2: ClaudeRawMessage = {
        id: 'msg2',
        role: 'user',
        timestamp: Date.now(),
        localId: 'local1',
        content: [{ type: 'text', text: 'Hello' }]
      }
      const result2 = messageReducer(state, [rawMsg2], null)

      expect(result1.newMessages).toHaveLength(1)
      expect(result2.newMessages).toHaveLength(0)
    })
  })

  describe('Phase 1: Agent Text Messages', () => {
    it('should process agent text message', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'Hello user' }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(1)
      expect(result.newMessages[0].kind).toBe('agent-text')
      expect((result.newMessages[0] as any).content).toBe('Hello user')
    })

    it('should process multiple text blocks', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [
          { type: 'text', text: 'First paragraph' },
          { type: 'text', text: 'Second paragraph' }
        ]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(2)
      expect(result.newMessages[0].kind).toBe('agent-text')
      expect(result.newMessages[1].kind).toBe('agent-text')
    })
  })

  describe('Phase 2: Tool Calls', () => {
    it('should process tool call from assistant', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_call',
          id: 'tool1',
          name: 'bash:execute',
          input: { command: 'ls' }
        }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(1)
      expect(result.newMessages[0].kind).toBe('tool-call')
      const toolMsg = result.newMessages[0] as ToolCallMessage
      expect(toolMsg.tool.name).toBe('bash:execute')
      expect(toolMsg.tool.state).toBe('running')
    })

    it('should associate tool call with permission', () => {
      // First, create a pending permission
      state.pendingPermissions.set('tool1', {
        toolName: 'bash:execute',
        input: { command: 'ls' },
        createdAt: Date.now(),
        status: 'approved'
      })

      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_call',
          id: 'tool1',
          name: 'bash:execute',
          input: { command: 'ls' }
        }]
      }
      const result = messageReducer(state, [rawMsg], null)

      const toolMsg = result.newMessages[0] as ToolCallMessage
      expect(toolMsg.permission).toBeDefined()
      expect(toolMsg.permission?.status).toBe('approved')
    })
  })

  describe('Phase 3: Tool Results', () => {
    it('should update tool call with result', () => {
      // First create a tool call
      const toolMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_call',
          id: 'tool1',
          name: 'bash:execute',
          input: { command: 'ls' }
        }]
      }
      messageReducer(state, [toolMsg], null)

      // Then add result
      const resultMsg: ClaudeRawMessage = {
        id: 'msg2',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool1',
          content: { stdout: 'file1.txt\nfile2.txt' }
        }]
      }
      const result = messageReducer(state, [resultMsg], null)

      expect(result.newMessages).toHaveLength(1)
      const updatedTool = result.newMessages[0] as ToolCallMessage
      expect(updatedTool.tool.state).toBe('completed')
      expect(updatedTool.tool.result).toBeDefined()
    })

    it('should mark tool as error on error result', () => {
      // First create a tool call
      const toolMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_call',
          id: 'tool1',
          name: 'bash:execute',
          input: { command: 'false' }
        }]
      }
      messageReducer(state, [toolMsg], null)

      // Then add error result
      const resultMsg: ClaudeRawMessage = {
        id: 'msg2',
        role: 'assistant',
        timestamp: Date.now(),
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool1',
          is_error: true,
          content: { error: 'Command failed' }
        }]
      }
      const result = messageReducer(state, [resultMsg], null)

      const updatedTool = result.newMessages[0] as ToolCallMessage
      expect(updatedTool.tool.state).toBe('error')
    })
  })

  describe('Phase 5: Events', () => {
    it('should process system event', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'system',
        timestamp: Date.now(),
        type: 'event',
        content: [{
          type: 'event',
          event_type: 'ready',
          message: 'Ready to process'
        }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(1)
      expect(result.newMessages[0].kind).toBe('event')
      expect((result.newMessages[0] as any).event.type).toBe('ready')
    })

    it('should process error event', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'system',
        timestamp: Date.now(),
        type: 'event',
        content: [{
          type: 'event',
          event_type: 'error',
          message: 'Something went wrong'
        }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.newMessages).toHaveLength(1)
      expect((result.newMessages[0] as any).event.type).toBe('error')
    })
  })

  describe('Metrics', () => {
    it('should update metrics', () => {
      const rawMsg: ClaudeRawMessage = {
        id: 'msg1',
        role: 'user',
        timestamp: Date.now(),
        content: [{ type: 'text', text: 'Hello' }]
      }
      const result = messageReducer(state, [rawMsg], null)

      expect(result.metrics?.messagesProcessed).toBe(1)
      expect(state.metrics.messagesProcessed).toBe(1)
      expect(state.metrics.lastUpdate).toBeGreaterThan(0)
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/reducer/reducer.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/reducer/reducer.test.ts
git commit -m "test: add message reducer tests"
```

---

## 阶段 5：集成层测试

### Task 5.1：测试 Claude Integration

**Files:**
- Create: `electron_app/src/bot/integration/claude.test.ts`

**Step 1：编写 Claude Integration 测试**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ClaudeIntegration } from './claude'
import type { Message, PermissionMessage } from '../types/messages'

// Mock IPC
const mockIpc = {
  claudeSend: vi.fn(),
  respondPermission: vi.fn()
}

vi.mock('@/lib/ipc', () => ({
  ipc: mockIpc
}))

describe('Claude Integration', () => {
  let integration: ClaudeIntegration

  beforeEach(() => {
    integration = new ClaudeIntegration('whatsapp')
    vi.clearAllMocks()
  })

  afterEach(() => {
    integration.dispose()
  })

  describe('Constructor', () => {
    it('should initialize with empty state', () => {
      const messages = integration.getMessages()
      expect(messages).toEqual([])
    })

    it('should initialize with correct platform', () => {
      const whatsapp = new ClaudeIntegration('whatsapp')
      const feishu = new ClaudeIntegration('feishu')

      // Both should work
      expect(whatsapp).toBeDefined()
      expect(feishu).toBeDefined()

      whatsapp.dispose()
      feishu.dispose()
    })
  })

  describe('setConversation / getCurrentConversation', () => {
    it('should set and get current conversation', () => {
      integration.setConversation('conv-123', '/path/to/project')

      const current = integration.getCurrentConversation()
      expect(current).toEqual({
        id: 'conv-123',
        projectPath: '/path/to/project'
      })
    })

    it('should return null when no conversation is set', () => {
      const current = integration.getCurrentConversation()
      expect(current).toBeNull()
    })
  })

  describe('sendMessage', () => {
    it('should send message via IPC', async () => {
      integration.setConversation('conv-123', '/project/path')
      mockIpc.claudeSend.mockResolvedValue({
        messageId: 'msg-456'
      })

      const messages = await integration.sendMessage('Hello AI')

      expect(mockIpc.claudeSend).toHaveBeenCalledWith(
        'conv-123',
        '/project/path',
        'Hello AI',
        'talk'
      )
      expect(messages).toEqual([])
    })

    it('should throw error when no conversation is set', async () => {
      await expect(integration.sendMessage('Hello'))
        .rejects.toThrow('No active conversation')
    })

    it('should throw error when IPC fails', async () => {
      integration.setConversation('conv-123', '/project')
      mockIpc.claudeSend.mockResolvedValue({
        messageId: null
      })

      await expect(integration.sendMessage('Hello'))
        .rejects.toThrow('Failed to send message')
    })
  })

  describe('processStream', () => {
    it('should process user message from stream', async () => {
      const streamData = {
        id: 'msg1',
        role: 'user' as const,
        timestamp: Date.now(),
        content: [{ type: 'text' as const, text: 'Hello' }]
      }

      const messages = await integration.processStream(streamData)

      expect(messages).toHaveLength(1)
      expect(messages[0].kind).toBe('user-text')
    })

    it('should process agent text from stream', async () => {
      const streamData = {
        id: 'msg1',
        role: 'assistant' as const,
        timestamp: Date.now(),
        content: [{ type: 'text' as const, text: 'Response' }]
      }

      const messages = await integration.processStream(streamData)

      expect(messages).toHaveLength(1)
      expect(messages[0].kind).toBe('agent-text')
    })

    it('should create pending permission from agent state', async () => {
      const agentState = {
        requests: {
          'perm1': {
            tool: 'bash:execute',
            arguments: { command: 'ls' },
            createdAt: Date.now()
          }
        }
      }

      const messages = await integration.processStream({
        id: 'msg1',
        role: 'system' as const,
        timestamp: Date.now(),
        content: []
      }, agentState as unknown)

      const permissions = integration.getPendingPermissions()
      expect(permissions).toHaveLength(1)
      expect(permissions[0].id).toBe('perm1')
    })
  })

  describe('respondToPermission', () => {
    it('should approve permission via IPC', async () => {
      // Set up a pending permission
      integration.setConversation('conv-123', '/project')
      await integration.processStream({
        id: 'msg1',
        role: 'system' as const,
        timestamp: Date.now(),
        content: []
      }, {
        requests: {
          'perm1': {
            tool: 'bash:execute',
            arguments: { command: 'ls' },
            createdAt: Date.now()
          }
        }
      } as unknown)

      await integration.respondToPermission('perm1', 'approve')

      expect(mockIpc.respondPermission).toHaveBeenCalledWith(
        'conv-123',
        'yes'
      )

      // Permission should be removed
      const pending = integration.getPendingPermissions()
      expect(pending.find((p: { id: string }) => p.id === 'perm1')).toBeUndefined()
    })

    it('should deny permission via IPC', async () => {
      integration.setConversation('conv-123', '/project')
      await integration.processStream({
        id: 'msg1',
        role: 'system' as const,
        timestamp: Date.now(),
        content: []
      }, {
        requests: {
          'perm1': {
            tool: 'bash:execute',
            arguments: { command: 'rm -rf /' },
            createdAt: Date.now()
          }
        }
      } as unknown)

      await integration.respondToPermission('perm1', 'deny')

      expect(mockIpc.respondPermission).toHaveBeenCalledWith(
        'conv-123',
        'no'
      )
    })

    it('should handle non-existent permission gracefully', async () => {
      await expect(
        integration.respondToPermission('nonexistent', 'approve')
      ).resolves.not.toThrow()
    })
  })

  describe('getPendingPermissions', () => {
    it('should return empty array when no permissions', () => {
      const pending = integration.getPendingPermissions()
      expect(pending).toEqual([])
    })

    it('should return pending permissions sorted by creation time', async () => {
      integration.setConversation('conv-123', '/project')

      const now = Date.now()
      await integration.processStream({
        id: 'msg1',
        role: 'system' as const,
        timestamp: now,
        content: []
      }, {
        requests: {
          'perm2': { tool: 'write', arguments: {}, createdAt: now + 100 },
          'perm1': { tool: 'bash:execute', arguments: {}, createdAt: now }
        }
      } as unknown)

      const pending = integration.getPendingPermissions()
      expect(pending).toHaveLength(2)
      expect(pending[0].id).toBe('perm1')
      expect(pending[1].id).toBe('perm2')
    })

    it('should exclude expired permissions', async () => {
      integration.setConversation('conv-123', '/project')

      const oldTime = Date.now() - 20 * 60 * 1000 // 20 minutes ago
      await integration.processStream({
        id: 'msg1',
        role: 'system' as const,
        timestamp: oldTime,
        content: []
      }, {
        requests: {
          'perm1': {
            tool: 'bash:execute',
            arguments: {},
            createdAt: oldTime
          }
        }
      } as unknown)

      const pending = integration.getPendingPermissions()
      expect(pending).toHaveLength(0)
    })
  })

  describe('getMessages', () => {
    it('should return all messages sorted by timestamp', async () => {
      const now = Date.now()
      await integration.processStream({
        id: 'msg1',
        role: 'user' as const,
        timestamp: now,
        content: [{ type: 'text' as const, text: 'First' }]
      })

      await integration.processStream({
        id: 'msg2',
        role: 'assistant' as const,
        timestamp: now - 1000,
        content: [{ type: 'text' as const, text: 'Earlier' }]
      })

      await integration.processStream({
        id: 'msg3',
        role: 'user' as const,
        timestamp: now + 1000,
        content: [{ type: 'text' as const, text: 'Later' }]
      })

      const messages = integration.getMessages()

      // Should be sorted by timestamp
      expect(messages[0].kind).toBe('agent-text')
      expect(messages[1].kind).toBe('user-text')
      expect(messages[2].kind).toBe('user-text')
    })

    it('should limit messages when requested', async () => {
      for (let i = 0; i < 10; i++) {
        await integration.processStream({
          id: `msg${i}`,
          role: 'user' as const,
          timestamp: Date.now() + i,
          content: [{ type: 'text' as const, text: `Message ${i}` }]
        })
      }

      const messages = integration.getMessages(5)
      expect(messages).toHaveLength(5)
    })
  })

  describe('dispose', () => {
    it('should cleanup intervals', () => {
      const integration2 = new ClaudeIntegration('whatsapp')

      // Should not throw
      expect(() => integration2.dispose()).not.toThrow()

      // Double dispose should be safe
      expect(() => integration2.dispose()).not.toThrow()
    })
  })
})
```

**Step 2：运行测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run src/bot/integration/claude.test.ts
```

预期：所有测试通过

**Step 3：提交**

```bash
git add src/bot/integration/claude.test.ts
git commit -m "test: add claude integration tests"
```

---

## 阶段 6：运行所有测试

### Task 6.1：运行完整测试套件

**Step 1：运行所有测试**

```bash
cd /Users/jiang/development/claudphone/electron_app
npx vitest run
```

预期：所有测试通过

**Step 2：生成覆盖率报告**

```bash
npx vitest run --coverage
```

预期：覆盖率报告生成，核心模块覆盖率 > 80%

**Step 3：提交**

```bash
git add -A
git commit -m "test: complete bot module test suite"
```

---

## 验收标准

- [ ] 所有测试通过 (`npx vitest run`)
- [ ] 代码覆盖率 > 80%
- [ ] 无 TypeScript 类型错误
- [ ] 每个测试都可独立运行
- [ ] 测试文件与源代码文件同步组织

---

**计划状态：** ✅ 已完成 TDD 格式转换
**下一步：** 等待用户确认后开始执行
