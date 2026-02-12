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
      expect(formatted).toContain('退出码')
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
