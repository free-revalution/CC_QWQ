/**
 * Message Reducer Tests
 *
 * Tests the 5-phase reducer architecture:
 * - Phase 0: Permission handling
 * - Phase 1: User and text messages
 * - Phase 2: Tool calls
 * - Phase 3: Tool results
 * - Phase 5: Events
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { messageReducer, createReducerState, type ClaudeRawMessage } from './reducer';
import type { ReducerState } from '../types/reducer';
import type { UserTextMessage, AgentTextMessage, ToolCallMessage, EventMessage } from '../types/messages';

describe('messageReducer', () => {
  let state: ReducerState;

  beforeEach(() => {
    state = createReducerState();
    vi.clearAllMocks();
  });

  describe('Phase 1: User Messages', () => {
    it('should process user text messages correctly', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-1',
        role: 'user',
        timestamp: 1234567890,
        content: [{ type: 'text', text: 'Hello, how are you?' }],
        localId: 'local-1'
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.hasChanges).toBe(true);
      expect(result.newMessages).toHaveLength(1);

      const userMsg = result.newMessages[0] as UserTextMessage;
      expect(userMsg.kind).toBe('user-text');
      expect(userMsg.content).toBe('Hello, how are you?');
      expect(userMsg.localId).toBe('local-1');
    });

    it('should handle user messages with string content fallback', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-2',
        role: 'user',
        timestamp: 1234567890,
        content: [{ type: 'text', text: 'Plain text content' }]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const userMsg = result.newMessages[0] as UserTextMessage;
      expect(userMsg.kind).toBe('user-text');
      expect(userMsg.content).toBe('Plain text content');
    });

    it('should deduplicate user messages by localId', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-3',
        role: 'user',
        timestamp: 1234567890,
        content: [{ type: 'text', text: 'Duplicate test' }],
        localId: 'local-dup'
      };

      // Process first time
      const result1 = messageReducer(state, [rawMessage]);
      expect(result1.newMessages).toHaveLength(1);

      // Process same message again
      const result2 = messageReducer(state, [rawMessage]);
      expect(result2.newMessages).toHaveLength(0);
      expect(result2.hasChanges).toBe(false);
    });

    it('should deduplicate user messages by messageId', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-dedup',
        role: 'user',
        timestamp: 1234567890,
        content: [{ type: 'text', text: 'Another duplicate' }]
      };

      // Process first time
      const result1 = messageReducer(state, [rawMessage]);
      expect(result1.newMessages).toHaveLength(1);

      // Process same message again
      const result2 = messageReducer(state, [rawMessage]);
      expect(result2.newMessages).toHaveLength(0);
    });
  });

  describe('Phase 1: Agent Text Messages', () => {
    it('should process agent text messages', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'agent-1',
        role: 'assistant',
        timestamp: 1234567890,
        content: [
          { type: 'text', text: 'I am an AI assistant.' }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const agentMsg = result.newMessages[0] as AgentTextMessage;
      expect(agentMsg.kind).toBe('agent-text');
      expect(agentMsg.content).toBe('I am an AI assistant.');
      expect(agentMsg.isStreaming).toBe(false);
    });

    it('should process multiple text blocks from single assistant message', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'agent-2',
        role: 'assistant',
        timestamp: 1234567890,
        content: [
          { type: 'text', text: 'First paragraph.' },
          { type: 'text', text: 'Second paragraph.' }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(2);
      expect((result.newMessages[0] as AgentTextMessage).content).toBe('First paragraph.');
      expect((result.newMessages[1] as AgentTextMessage).content).toBe('Second paragraph.');
    });
  });

  describe('Phase 2: Tool Calls', () => {
    it('should create tool call message with permission reference', () => {
      // First add a pending permission
      state.pendingPermissions.set('tool-1', {
        toolName: 'bash:execute',
        input: { command: 'ls -la' },
        createdAt: 1234567890,
        status: 'approved'
      });

      const rawMessage: ClaudeRawMessage = {
        id: 'msg-4',
        role: 'assistant',
        timestamp: 1234567891,
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'bash:execute',
            input: { command: 'ls -la' }
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const toolMsg = result.newMessages[0] as ToolCallMessage;
      expect(toolMsg.kind).toBe('tool-call');
      expect(toolMsg.tool.name).toBe('bash:execute');
      expect(toolMsg.tool.state).toBe('running');
      expect(toolMsg.permission?.status).toBe('approved');
    });

    it('should create tool call message without permission', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-5',
        role: 'assistant',
        timestamp: 1234567890,
        content: [
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'str_replace_editor',
            input: { command: 'str_replace', path: '/tmp/test.txt' }
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const toolMsg = result.newMessages[0] as ToolCallMessage;
      expect(toolMsg.kind).toBe('tool-call');
      expect(toolMsg.tool.name).toBe('str_replace_editor');
      expect(toolMsg.permission).toBeUndefined();
      expect(toolMsg.summary).toContain('str_replace_editor');
    });
  });

  describe('Phase 3: Tool Results', () => {
    it('should update tool call with successful result', () => {
      // First create a tool call
      state.toolIdToMessageId.set('tool-3', 'msg-tool-3');
      const toolMsg: ToolCallMessage = {
        id: 'msg-tool-3',
        kind: 'tool-call',
        timestamp: 1234567890,
        platform: 'whatsapp',
        conversationId: '',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'echo test' },
          createdAt: 1234567890,
          startedAt: 1234567890
        }
      };
      state.messages.set('msg-tool-3', toolMsg);

      // Now process the result
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-6',
        role: 'assistant',
        timestamp: 1234567891,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-3',
            is_error: false,
            content: 'test output'
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const updatedToolMsg = result.newMessages[0] as ToolCallMessage;
      expect(updatedToolMsg.tool.state).toBe('completed');
      expect(updatedToolMsg.tool.completedAt).toBe(1234567891);
      expect(updatedToolMsg.tool.result).toBe('test output');
    });

    it('should update tool call with error result', () => {
      // First create a tool call
      state.toolIdToMessageId.set('tool-4', 'msg-tool-4');
      const toolMsg: ToolCallMessage = {
        id: 'msg-tool-4',
        kind: 'tool-call',
        timestamp: 1234567890,
        platform: 'whatsapp',
        conversationId: '',
        tool: {
          name: 'bash:execute',
          state: 'running',
          input: { command: 'exit 1' },
          createdAt: 1234567890,
          startedAt: 1234567890
        }
      };
      state.messages.set('msg-tool-4', toolMsg);

      // Now process the error result
      const rawMessage: ClaudeRawMessage = {
        id: 'msg-7',
        role: 'assistant',
        timestamp: 1234567891,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-4',
            is_error: true,
            content: { error: 'Command failed' }
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const updatedToolMsg = result.newMessages[0] as ToolCallMessage;
      expect(updatedToolMsg.tool.state).toBe('error');
      expect(updatedToolMsg.summary).toContain('错误');
    });
  });

  describe('Phase 5: Events', () => {
    it('should process system event messages', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'event-1',
        role: 'system',
        timestamp: 1234567890,
        type: 'event',
        content: [
          {
            type: 'event',
            event_type: 'ready',
            message: 'Assistant ready'
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const eventMsg = result.newMessages[0] as EventMessage;
      expect(eventMsg.kind).toBe('event');
      expect(eventMsg.event.type).toBe('ready');
      expect(eventMsg.event.message).toBe('Assistant ready');
    });

    it('should process error event messages', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'event-2',
        role: 'system',
        timestamp: 1234567890,
        type: 'event',
        content: [
          {
            type: 'event',
            event_type: 'error',
            message: 'Connection failed'
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const eventMsg = result.newMessages[0] as EventMessage;
      expect(eventMsg.kind).toBe('event');
      expect(eventMsg.event.type).toBe('error');
      expect(eventMsg.event.message).toBe('Connection failed');
    });
  });

  describe('Metrics', () => {
    it('should track messages processed', () => {
      const rawMessages: ClaudeRawMessage[] = [
        {
          id: 'msg-metrics-1',
          role: 'user',
          timestamp: 1234567890,
          content: [{ type: 'text', text: 'First message' }]
        },
        {
          id: 'msg-metrics-2',
          role: 'assistant',
          timestamp: 1234567891,
          content: [{ type: 'text', text: 'Response' }]
        },
        {
          id: 'msg-metrics-3',
          role: 'user',
          timestamp: 1234567892,
          content: [{ type: 'text', text: 'Second message' }]
        }
      ];

      const result = messageReducer(state, rawMessages);

      expect(result.metrics?.messagesProcessed).toBe(3);
      expect(state.metrics.messagesProcessed).toBe(3);
    });

    it('should update lastUpdate timestamp', () => {
      const before = Date.now();

      const rawMessage: ClaudeRawMessage = {
        id: 'msg-time',
        role: 'user',
        timestamp: 1234567890,
        content: [{ type: 'text', text: 'Test' }]
      };

      messageReducer(state, [rawMessage]);

      expect(state.metrics.lastUpdate).toBeGreaterThanOrEqual(before);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex multi-phase workflow', () => {
      // Phase 1: User message
      const userMsg: ClaudeRawMessage = {
        id: 'complex-1',
        role: 'user',
        timestamp: 1000,
        content: [{ type: 'text', text: 'Run ls command' }]
      };

      // Phase 1: Agent response
      const agentMsg: ClaudeRawMessage = {
        id: 'complex-2',
        role: 'assistant',
        timestamp: 2000,
        content: [
          { type: 'text', text: 'I will run that command.' }
        ]
      };

      // Phase 2: Tool call
      const toolCallMsg: ClaudeRawMessage = {
        id: 'complex-3',
        role: 'assistant',
        timestamp: 3000,
        content: [
          {
            type: 'tool_call',
            id: 'tool-complex',
            name: 'bash:execute',
            input: { command: 'ls' }
          }
        ]
      };

      // Phase 3: Tool result
      const toolResultMsg: ClaudeRawMessage = {
        id: 'complex-4',
        role: 'assistant',
        timestamp: 4000,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-complex',
            is_error: false,
            content: 'file1.txt\nfile2.txt'
          }
        ]
      };

      // Phase 5: Event
      const eventMsg: ClaudeRawMessage = {
        id: 'complex-5',
        role: 'system',
        timestamp: 5000,
        type: 'event',
        content: [
          { type: 'event', event_type: 'ready', message: 'Done' }
        ]
      };

      // Process all messages
      const result = messageReducer(state, [
        userMsg,
        agentMsg,
        toolCallMsg,
        toolResultMsg,
        eventMsg
      ]);

      // Verify all phases processed
      expect(result.newMessages.length).toBeGreaterThan(0);

      // Check user message
      const userMessages = result.newMessages.filter(m => m.kind === 'user-text');
      expect(userMessages).toHaveLength(1);

      // Check agent text
      const agentMessages = result.newMessages.filter(m => m.kind === 'agent-text');
      expect(agentMessages).toHaveLength(1);

      // Check tool call
      const toolCalls = result.newMessages.filter(m => m.kind === 'tool-call');
      expect(toolCalls).toHaveLength(1);
      const toolCall = toolCalls[0] as ToolCallMessage;
      expect(toolCall.tool.state).toBe('completed');
      expect(toolCall.tool.result).toBe('file1.txt\nfile2.txt');

      // Check event
      const events = result.newMessages.filter(m => m.kind === 'event');
      expect(events).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content array', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'edge-1',
        role: 'user',
        timestamp: 1234567890,
        content: []
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const userMsg = result.newMessages[0] as UserTextMessage;
      expect(userMsg.content).toBe('');
    });

    it('should handle non-array content for user messages', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'edge-2',
        role: 'user',
        timestamp: 1234567890,
        content: null as unknown as unknown[]
      };

      const result = messageReducer(state, [rawMessage]);

      expect(result.newMessages).toHaveLength(1);
      const userMsg = result.newMessages[0] as UserTextMessage;
      expect(userMsg.content).toBe('null');
    });

    it('should ignore tool result for unknown tool', () => {
      const rawMessage: ClaudeRawMessage = {
        id: 'edge-3',
        role: 'assistant',
        timestamp: 1234567890,
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'unknown-tool',
            is_error: false,
            content: 'some result'
          }
        ]
      };

      const result = messageReducer(state, [rawMessage]);

      // Should not create a new message
      expect(result.newMessages).toHaveLength(0);
    });

    it('should handle empty raw messages array', () => {
      const result = messageReducer(state, []);

      expect(result.newMessages).toHaveLength(0);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('Phase 0: Permission Handling', () => {
    it('should create permission messages from agent state', () => {
      const agentState = {
        requests: {
          'perm-1': {
            tool: 'bash:execute',
            arguments: { command: 'test' },
            createdAt: 1234567890
          }
        }
      };

      const result = messageReducer(state, [], agentState);

      expect(result.permissions).toHaveLength(1);
      expect(result.newMessages).toHaveLength(1);

      const permMsg = result.permissions[0];
      expect(permMsg.kind).toBe('permission');
      expect(permMsg.permission.toolName).toBe('bash:execute');
      expect(permMsg.permission.status).toBe('pending');
    });

    it('should deduplicate permission messages', () => {
      // Add permission to state as already processed
      state.toolIdToMessageId.set('perm-2', 'existing-msg');

      const agentState = {
        requests: {
          'perm-2': {
            tool: 'bash:execute',
            arguments: { command: 'test' },
            createdAt: 1234567890
          }
        }
      };

      const result = messageReducer(state, [], agentState);

      expect(result.permissions).toHaveLength(0);
      expect(result.newMessages).toHaveLength(0);
    });
  });
});
