import { describe, it, expect } from 'vitest'
import type {
  UserTextMessage, AgentTextMessage, ToolCallMessage,
  ToolResultMessage, PermissionMessage, EventMessage, ErrorMessage
} from './messages'
import {
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
