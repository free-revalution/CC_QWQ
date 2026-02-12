/**
 * Chat Message Formatter Tests
 *
 * Tests for the chat message formatter that formats messages
 * for display in chat platforms (WhatsApp, Feishu).
 */

import { describe, it, expect } from 'vitest'
import {
  formatMessageForChat,
  formatMessagesForChat,
  formatPermissionRequest,
  getCommandHelpText
} from './chat'
import type {
  Message,
  UserTextMessage,
  AgentTextMessage,
  ToolCallMessage,
  ToolResultMessage,
  PermissionMessage,
  EventMessage,
  ErrorMessage
} from '../types/messages'

describe('Chat Formatter', () => {
  // Helper to create a base message
  const createBaseMessage = (kind: Message['kind'], platform: 'whatsapp' | 'feishu' = 'whatsapp'): Omit<Message, 'kind' | 'timestamp'> => ({
    id: 'msg-123',
    platform,
    conversationId: 'conv-456'
  })

  describe('formatMessageForChat - User Text', () => {
    it('should format user text message with emoji', () => {
      const message: UserTextMessage = {
        ...createBaseMessage('user-text'),
        kind: 'user-text',
        timestamp: Date.now(),
        content: 'Hello, how are you?'
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('👤')
      expect(formatted).toContain('Hello, how are you?')
    })

    it('should truncate user message in compact mode', () => {
      const message: UserTextMessage = {
        ...createBaseMessage('user-text'),
        kind: 'user-text',
        timestamp: Date.now(),
        content: 'This is a very long message that should be truncated in compact mode because it exceeds the character limit'
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp', compact: true })

      expect(formatted).toContain('👤')
      expect(formatted.length).toBeLessThan(120) // 100 chars + emoji + "..."
      expect(formatted).toContain('...')
    })
  })

  describe('formatMessageForChat - Agent Text', () => {
    it('should format agent text message', () => {
      const message: AgentTextMessage = {
        ...createBaseMessage('agent-text'),
        kind: 'agent-text',
        timestamp: Date.now(),
        content: 'I am doing well, thank you!'
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('I am doing well, thank you!')
      expect(formatted).toContain('✅')
      expect(formatted).toContain('回复完成')
    })

    it('should show streaming indicator for streaming messages', () => {
      const message: AgentTextMessage = {
        ...createBaseMessage('agent-text'),
        kind: 'agent-text',
        timestamp: Date.now(),
        content: 'Thinking...',
        isStreaming: true
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('🤖')
      expect(formatted).toContain('AI 思考中')
      expect(formatted).not.toContain('回复完成')
    })

    it('should include metadata when present', () => {
      const message: AgentTextMessage = {
        ...createBaseMessage('agent-text'),
        kind: 'agent-text',
        timestamp: Date.now(),
        content: 'Response text',
        metadata: {
          model: 'claude-opus-4-5',
          tokensUsed: 1500
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp', compact: false })

      expect(formatted).toContain('claude-opus-4-5')
      expect(formatted).toContain('1500 tokens')
      expect(formatted).toContain('📊')
      expect(formatted).toContain('模型')
    })
  })

  describe('formatMessageForChat - Tool Call', () => {
    it('should format running tool call', () => {
      const message: ToolCallMessage = {
        ...createBaseMessage('tool-call'),
        kind: 'tool-call',
        timestamp: Date.now(),
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'npm install' },
          createdAt: Date.now(),
          startedAt: Date.now()
        },
        summary: '🔧 Bash: npm install'
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('Bash')
      expect(formatted).toContain('npm install')
      expect(formatted).toContain('⏳')
      expect(formatted).toContain('运行中')
    })

    it('should format completed tool call', () => {
      const message: ToolCallMessage = {
        ...createBaseMessage('tool-call'),
        kind: 'tool-call',
        timestamp: Date.now(),
        tool: {
          name: 'bash:execute',
          state: 'completed',
          input: { command: 'echo hello' },
          createdAt: Date.now() - 1000,
          startedAt: Date.now() - 900,
          completedAt: Date.now(),
          result: { exit_code: 0, stdout: 'hello' }
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('✅')
      expect(formatted).toContain('完成')
    })

    it('should show pending permission prompt', () => {
      const message: ToolCallMessage = {
        ...createBaseMessage('tool-call'),
        kind: 'tool-call',
        timestamp: Date.now(),
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'rm -rf /' },
          createdAt: Date.now()
        },
        permission: {
          id: 'perm-123',
          status: 'pending',
          reason: 'Dangerous command'
        },
        summary: '🔧 Bash: rm -rf /'
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('等待批准')
      expect(formatted).toContain('/approve')
      expect(formatted).toContain('/deny')
    })
  })

  describe('formatMessageForChat - Tool Result', () => {
    it('should format successful tool result', () => {
      const message: ToolResultMessage = {
        ...createBaseMessage('tool-result'),
        kind: 'tool-result',
        timestamp: Date.now(),
        toolUseId: 'tool-123',
        toolName: 'bash:execute',
        result: { exit_code: 0, stdout: 'success' },
        isError: false
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('✅')
      expect(formatted).toContain('工具执行完成')
      expect(formatted).toContain('bash:execute')
    })

    it('should format error tool result', () => {
      const message: ToolResultMessage = {
        ...createBaseMessage('tool-result'),
        kind: 'tool-result',
        timestamp: Date.now(),
        toolUseId: 'tool-123',
        toolName: 'bash:execute',
        result: { error: 'Command failed' },
        isError: true
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('❌')
      expect(formatted).toContain('工具执行错误')
      expect(formatted).toContain('bash:execute')
    })

    it('should show truncation notice for long output', () => {
      const message: ToolResultMessage = {
        ...createBaseMessage('tool-result'),
        kind: 'tool-result',
        timestamp: Date.now(),
        toolUseId: 'tool-123',
        toolName: 'bash:execute',
        result: { exit_code: 0 },
        fullOutput: 'x'.repeat(1000),
        isError: false
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('输出过长')
      expect(formatted).toContain('/full')
    })
  })

  describe('formatMessageForChat - Permission', () => {
    it('should format pending permission request', () => {
      const message: PermissionMessage = {
        ...createBaseMessage('permission'),
        kind: 'permission',
        timestamp: Date.now(),
        permission: {
          id: 'perm-123',
          toolName: 'bash:execute',
          input: { command: 'cat file.txt' },
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' },
          { command: '/deny', label: '拒绝' }
        ]
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('🔔')
      expect(formatted).toContain('权限请求')
      expect(formatted).toContain('bash:execute')
      expect(formatted).toContain('⏳')
      expect(formatted).toContain('等待批准')
    })

    it('should format approved permission', () => {
      const message: PermissionMessage = {
        ...createBaseMessage('permission'),
        kind: 'permission',
        timestamp: Date.now(),
        permission: {
          id: 'perm-123',
          toolName: 'bash:execute',
          input: { command: 'ls' },
          status: 'approved'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('✅')
      expect(formatted).toContain('已批准')
    })

    it('should format denied permission', () => {
      const message: PermissionMessage = {
        ...createBaseMessage('permission'),
        kind: 'permission',
        timestamp: Date.now(),
        permission: {
          id: 'perm-123',
          toolName: 'bash:execute',
          input: { command: 'rm file' },
          status: 'denied'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('❌')
      expect(formatted).toContain('已拒绝')
    })
  })

  describe('formatMessageForChat - Event', () => {
    it('should format ready event', () => {
      const message: EventMessage = {
        ...createBaseMessage('event'),
        kind: 'event',
        timestamp: Date.now(),
        event: {
          type: 'ready'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('Claude Code 已就绪')
      expect(formatted).toContain('✅')
    })

    it('should format mode_switch event', () => {
      const message: EventMessage = {
        ...createBaseMessage('event'),
        kind: 'event',
        timestamp: Date.now(),
        event: {
          type: 'mode_switch',
          data: { mode: 'develop' }
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('模式切换')
      expect(formatted).toContain('develop')
    })

    it('should format context_reset event', () => {
      const message: EventMessage = {
        ...createBaseMessage('event'),
        kind: 'event',
        timestamp: Date.now(),
        event: {
          type: 'context_reset'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('上下文已重置')
      expect(formatted).toContain('🔄')
    })

    it('should format compaction event', () => {
      const message: EventMessage = {
        ...createBaseMessage('event'),
        kind: 'event',
        timestamp: Date.now(),
        event: {
          type: 'compaction'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('对话已压缩')
      expect(formatted).toContain('📝')
    })

    it('should format error event', () => {
      const message: EventMessage = {
        ...createBaseMessage('event'),
        kind: 'event',
        timestamp: Date.now(),
        event: {
          type: 'error',
          message: 'Something went wrong'
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('错误')
      expect(formatted).toContain('Something went wrong')
      expect(formatted).toContain('❌')
    })
  })

  describe('formatMessageForChat - Error', () => {
    it('should format error message', () => {
      const message: ErrorMessage = {
        ...createBaseMessage('error'),
        kind: 'error',
        timestamp: Date.now(),
        error: {
          code: 'ERR_001',
          message: 'An error occurred',
          details: { context: 'test context' }
        }
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('❌')
      expect(formatted).toContain('错误')
      expect(formatted).toContain('An error occurred')
      expect(formatted).toContain('详情')
    })

    it('should show recoverable message for recoverable errors', () => {
      const message: ErrorMessage = {
        ...createBaseMessage('error'),
        kind: 'error',
        timestamp: Date.now(),
        error: {
          message: 'Temporary failure'
        },
        recoverable: true
      }

      const formatted = formatMessageForChat(message, { platform: 'whatsapp' })

      expect(formatted).toContain('💡')
      expect(formatted).toContain('可以恢复')
    })
  })

  describe('formatMessagesForChat - Batch Formatting', () => {
    it('should batch multiple messages into single output', () => {
      const messages: Message[] = [
        {
          ...createBaseMessage('user-text'),
          kind: 'user-text',
          timestamp: Date.now(),
          content: 'User message'
        },
        {
          ...createBaseMessage('agent-text'),
          kind: 'agent-text',
          timestamp: Date.now(),
          content: 'Agent response'
        }
      ]

      const formatted = formatMessagesForChat(messages, { platform: 'whatsapp' })

      expect(formatted).toHaveLength(1)
      expect(formatted[0]).toContain('👤')
      expect(formatted[0]).toContain('User message')
      expect(formatted[0]).toContain('Agent response')
    })

    it('should split into multiple batches when exceeding limit', () => {
      const longContent = 'x'.repeat(3000)
      const messages: Message[] = [
        {
          ...createBaseMessage('user-text'),
          kind: 'user-text',
          timestamp: Date.now(),
          content: longContent
        },
        {
          ...createBaseMessage('agent-text'),
          kind: 'agent-text',
          timestamp: Date.now(),
          content: longContent
        }
      ]

      const formatted = formatMessagesForChat(messages, { platform: 'whatsapp' })

      // Should split into at least 2 batches due to WhatsApp limit
      expect(formatted.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('formatPermissionRequest', () => {
    it('should format permission request with all details', () => {
      const message: PermissionMessage = {
        ...createBaseMessage('permission'),
        kind: 'permission',
        timestamp: Date.now(),
        permission: {
          id: 'perm-123',
          toolName: 'str_replace_editor',
          input: {
            command: 'edit',
            path: '/path/to/file.ts',
            old_str: 'old content',
            new_str: 'new content'
          },
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' },
          { command: '/deny', label: '拒绝' }
        ]
      }

      const formatted = formatPermissionRequest(message, 'whatsapp')

      expect(formatted).toContain('🔔')
      expect(formatted).toContain('权限请求')
      expect(formatted).toContain('str_replace_editor')
      expect(formatted).toContain('可用操作')
      expect(formatted).toContain('/approve')
      expect(formatted).toContain('/deny')
    })

    it('should truncate long input for whatsapp', () => {
      const longInput = {
        command: 'edit',
        path: '/very/long/path/that/exceeds/the/limit/for/whatsapp/display/file.ts',
        old_str: 'x'.repeat(200),
        new_str: 'y'.repeat(200)
      }
      const message: PermissionMessage = {
        ...createBaseMessage('permission'),
        kind: 'permission',
        timestamp: Date.now(),
        permission: {
          id: 'perm-123',
          toolName: 'edit',
          input: longInput,
          status: 'pending'
        }
      }

      const whatsapp = formatPermissionRequest(message, 'whatsapp')
      const feishu = formatPermissionRequest(message, 'feishu')

      // WhatsApp should truncate more aggressively
      expect(whatsapp.length).toBeLessThan(feishu.length)
      expect(whatsapp).toContain('...')
    })
  })

  describe('getCommandHelpText', () => {
    it('should return formatted help text', () => {
      const help = getCommandHelpText()

      expect(help).toContain('可用命令')
      expect(help).toContain('/status')
      expect(help).toContain('/history')
      expect(help).toContain('/full')
      expect(help).toContain('/approve')
      expect(help).toContain('/deny')
      expect(help).toContain('/help')
    })

    it('should include emoji icons', () => {
      const help = getCommandHelpText()

      expect(help).toContain('📖')
    })
  })
})
