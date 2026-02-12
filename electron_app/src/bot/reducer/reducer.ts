/**
 * Message Reducer for Bot Integration
 *
 * Based on Happy's 5-phase reducer architecture:
 * - Phase 0: Permission handling
 * - Phase 1: User and text messages
 * - Phase 2: Tool calls
 * - Phase 3: Tool results
 * - Phase 4: Sidechains (simplified)
 * - Phase 5: Events
 */

import type {
  Message, UserTextMessage, AgentTextMessage, ToolCallMessage,
  PermissionMessage, EventMessage
} from '../types/messages';
import { isPermissionMessage, isToolCallMessage } from '../types/messages';
import type { ReducerState, ReducerResult } from '../types/reducer';
import { createReducer } from '../types/reducer';

// Raw message from Claude Code (simplified interface)
export interface ClaudeRawMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  content: unknown[];
  type?: 'text' | 'tool_call' | 'tool_result' | 'permission_request' | 'event';
  localId?: string;
}

// Content block types
interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolCallBlock {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, unknown>;
  text?: string;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  is_error?: boolean;
  content: unknown;
}

interface EventBlock {
  type: 'event';
  event_type?: 'error' | 'ready' | 'mode_switch' | 'context_reset' | 'compaction';
  message?: string;
  [key: string]: unknown;
}

// Type guard for text block
function isTextBlock(block: unknown): block is TextBlock {
  return typeof block === 'object' && block !== null && 'type' in block && block.type === 'text';
}

// Type guard for tool call block
function isToolCallBlock(block: unknown): block is ToolCallBlock {
  return typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_call';
}

// Type guard for tool result block
function isToolResultBlock(block: unknown): block is ToolResultBlock {
  return typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_result';
}

// Type guard for event block
function isEventBlock(block: unknown): block is EventBlock {
  return typeof block === 'object' && block !== null && 'type' in block && block.type === 'event';
}

/**
 * Main reducer function - processes raw messages through all phases
 */
export function messageReducer(
  state: ReducerState,
  rawMessages: ClaudeRawMessage[],
  agentState?: unknown
): ReducerResult {

  const newMessages: Message[] = [];
  const permissions: PermissionMessage[] = [];
  const changed = new Set<string>();

  //
  // Phase 0: Handle permissions from agent state
  //

  if (agentState && typeof agentState === 'object' && 'requests' in agentState) {
    const requests = agentState.requests as Record<string, unknown>;
    for (const [permId, request] of Object.entries(requests)) {
      // Skip if already processed
      if (state.toolIdToMessageId.has(permId)) {
        continue;
      }

      const req = request as { tool?: string; arguments?: Record<string, unknown>; createdAt?: number };

      // Create permission message
      const permMessage: PermissionMessage = {
        id: allocateId(),
        kind: 'permission',
        timestamp: req.createdAt || Date.now(),
        platform: 'whatsapp', // Will be set appropriately
        conversationId: '',   // Will be set from context
        permission: {
          id: permId,
          toolName: req.tool || 'unknown',
          input: req.arguments || {},
          status: 'pending'
        },
        actions: [
          { command: '/approve', label: '批准' },
          { command: '/deny', label: '拒绝' }
        ]
      };

      state.messages.set(permMessage.id, permMessage);
      state.toolIdToMessageId.set(permId, permMessage.id);
      state.pendingPermissions.set(permId, {
        toolName: req.tool || 'unknown',
        input: req.arguments || {},
        createdAt: req.createdAt || Date.now(),
        status: 'pending'
      });

      permissions.push(permMessage);
      changed.add(permMessage.id);
    }
  }

  //
  // Phase 1: Process user messages and text messages
  //

  for (const msg of rawMessages) {
    // Skip if already processed
    if (msg.localId && state.localIds.has(msg.localId)) {
      continue;
    }
    if (state.messageIds.has(msg.id)) {
      continue;
    }

    // Mark as seen
    state.messageIds.set(msg.id, msg.id);
    if (msg.localId) {
      state.localIds.set(msg.localId, msg.id);
    }

    // Process user message
    if (msg.role === 'user') {
      // Extract text from content array or use raw content
      const contentArray = Array.isArray(msg.content) ? msg.content : [];
      const textBlock = contentArray.find(isTextBlock);
      const content = textBlock?.text ?? (msg.content === null ? 'null' : String(msg.content));

      const userMsg: UserTextMessage = {
        id: allocateId(),
        kind: 'user-text',
        timestamp: msg.timestamp,
        platform: 'whatsapp', // Will be set from context
        conversationId: '',
        content,
        localId: msg.localId
      };

      state.messages.set(userMsg.id, userMsg);
      newMessages.push(userMsg);
      changed.add(userMsg.id);
    }

    // Process assistant text content
    else if (msg.role === 'assistant') {
      const contentArray = Array.isArray(msg.content) ? msg.content : [];
      for (const block of contentArray) {
        if (isTextBlock(block)) {
          const agentMsg: AgentTextMessage = {
            id: allocateId(),
            kind: 'agent-text',
            timestamp: msg.timestamp,
            platform: 'whatsapp',
            conversationId: '',
            content: block.text,
            isStreaming: false
          };

          state.messages.set(agentMsg.id, agentMsg);
          newMessages.push(agentMsg);
          changed.add(agentMsg.id);
        }
      }
    }
  }

  //
  // Phase 2: Process tool calls
  //

  for (const msg of rawMessages) {
    if (msg.role === 'assistant') {
      const contentArray = Array.isArray(msg.content) ? msg.content : [];
      for (const block of contentArray) {
        if (isToolCallBlock(block)) {
          const existingMsgId = state.toolIdToMessageId.get(block.id);

          if (existingMsgId) {
            // Update existing permission message
            const existing = state.messages.get(existingMsgId);
            if (existing && isPermissionMessage(existing)) {
              // Convert to tool call message
              const toolMsg: ToolCallMessage = {
                ...existing,
                kind: 'tool-call',
                tool: {
                  name: block.name,
                  state: 'running',
                  input: block.input,
                  description: block.text || '',
                  createdAt: msg.timestamp,
                  startedAt: msg.timestamp
                },
                permission: existing.permission,
                summary: `🔧 ${block.name}: ${generateToolSummary(block)}`
              };

              state.messages.set(existingMsgId, toolMsg);
              newMessages.push(toolMsg);
              changed.add(existingMsgId);
            }
          } else {
            // Check for stored permission
            const perm = state.pendingPermissions.get(block.id);

            const toolMsg: ToolCallMessage = {
              id: allocateId(),
              kind: 'tool-call',
              timestamp: msg.timestamp,
              platform: 'whatsapp',
              conversationId: '',
              tool: {
                name: block.name,
                state: perm?.status === 'approved' ? 'running' : 'running',
                input: block.input,
                description: block.text || '',
                createdAt: perm?.createdAt || msg.timestamp,
                startedAt: msg.timestamp
              },
              permission: perm ? {
                id: block.id,
                status: perm.status,
                reason: perm.reason
              } : undefined,
              summary: `🔧 ${block.name}: ${generateToolSummary(block)}`
            };

            state.messages.set(toolMsg.id, toolMsg);
            state.toolIdToMessageId.set(block.id, toolMsg.id);
            newMessages.push(toolMsg);
            changed.add(toolMsg.id);
          }
        }
      }
    }
  }

  //
  // Phase 3: Process tool results
  //

  for (const msg of rawMessages) {
    if (msg.role === 'assistant') {
      const contentArray = Array.isArray(msg.content) ? msg.content : [];
      for (const block of contentArray) {
        if (isToolResultBlock(block)) {
          const msgId = state.toolIdToMessageId.get(block.tool_use_id);
          if (!msgId) continue;

          const existing = state.messages.get(msgId);
          if (!existing || !isToolCallMessage(existing)) continue;

          // Update tool state
          existing.tool.state = block.is_error ? 'error' : 'completed';
          existing.tool.completedAt = msg.timestamp;
          existing.tool.result = block.content;

          // Generate summary
          existing.summary = generateToolResultSummary(existing.tool);

          changed.add(msgId);
          newMessages.push(existing);
        }
      }
    }
  }

  //
  // Phase 4: Sidechains (simplified - just track Task tools)
  //

  // For chat bot, we'll simplify sidechain handling
  // Just note which tools are Task/subagent tools

  //
  // Phase 5: Events
  //

  for (const msg of rawMessages) {
    if (msg.role === 'system' || msg.type === 'event') {
      // Handle event messages
      const contentArray = Array.isArray(msg.content) ? msg.content : [];
      const contentObj = (contentArray[0] ?? {}) as Record<string, unknown>;

      const eventBlock = isEventBlock(contentObj) ? contentObj : null;

      const eventMsg: EventMessage = {
        id: allocateId(),
        kind: 'event',
        timestamp: msg.timestamp,
        platform: 'whatsapp',
        conversationId: '',
        event: {
          type: eventBlock?.event_type ?? 'ready',
          data: contentObj,
          message: eventBlock?.message
        }
      };

      state.messages.set(eventMsg.id, eventMsg);
      newMessages.push(eventMsg);
      changed.add(eventMsg.id);
    }
  }

  // Update metrics
  state.metrics.messagesProcessed += rawMessages.length;
  state.metrics.lastUpdate = Date.now();

  return {
    newMessages: Array.from(changed).map(id => state.messages.get(id)!),
    permissions,
    hasChanges: changed.size > 0,
    metrics: state.metrics
  };
}

//
// Helper functions
//

function allocateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateToolSummary(tool: { name: string; input?: Record<string, unknown> }): string {
  // Generate concise summary for chat display
  if (tool.name === 'bash:execute') {
    const input = tool.input as Record<string, unknown> | undefined;
    const cmd = (input?.command as string | undefined) ?? (input?.cmd as string | undefined) ?? '';
    return cmd.length > 30 ? cmd.substring(0, 30) + '...' : cmd;
  }
  if (tool.name === 'str_replace_editor') {
    const input = tool.input as Record<string, unknown> | undefined;
    return (input?.path as string | undefined) ?? 'file edit';
  }
  return tool.name;
}

function generateToolResultSummary(tool: { state: 'completed' | 'error' | 'running' }): string {
  if (tool.state === 'completed') {
    return `✅ 完成`;
  } else if (tool.state === 'error') {
    return `❌ 错误`;
  } else {
    return `⏳ 运行中...`;
  }
}

/**
 * Create a new reducer state
 */
export function createReducerState(): ReducerState {
  return createReducer();
}
