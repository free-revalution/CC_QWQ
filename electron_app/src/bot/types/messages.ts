/**
 * Message Type System for CC QwQ Bot Integration
 *
 * Based on Happy's flattened message architecture where each message
 * represents a single content block.
 */

// Message kind discriminator
export type BotMessageKind =
  | 'user-text'        // User text message
  | 'agent-text'       // AI agent text response
  | 'tool-call'        // Tool invocation
  | 'tool-result'      // Tool execution result
  | 'permission'       // Permission request
  | 'event'           // System event
  | 'error';          // Error message

// Base message interface
export interface BaseMessage {
  id: string;
  kind: BotMessageKind;
  timestamp: number;
  platform: 'whatsapp' | 'feishu';
  conversationId: string;
  // Properties common to all message types
  isError?: boolean;
  summary?: string;
  fullOutput?: string;
}

// User text message
export interface UserTextMessage extends BaseMessage {
  kind: 'user-text';
  content: string;
  displayText?: string;  // Optional display text (for formatted input)
  localId?: string;      // Client-side message ID for deduplication
}

// Agent text message
export interface AgentTextMessage extends BaseMessage {
  kind: 'agent-text';
  content: string;
  isStreaming?: boolean;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    finishReason?: string;
  };
}

// Tool state
export type ToolState = 'running' | 'completed' | 'error';

// Permission status
export type PermissionStatus = 'pending' | 'approved' | 'denied' | 'canceled';

// Permission decision type
export type PermissionDecision = 'approved' | 'approved_for_session' | 'denied' | 'abort';

// Tool input types
export interface BashToolInput {
  command?: string;
  cmd?: string;
  cwd?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface EditToolInput {
  command?: string;
  path?: string;
  file_path?: string;
  old_str?: string;
  new_str?: string;
  [key: string]: unknown;
}

export interface WriteToolInput {
  path?: string;
  content?: string;
  [key: string]: unknown;
}

export interface TodoWriteToolInput {
  todos?: Array<{
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'high' | 'medium' | 'low';
    content: string;
  }>;
  [key: string]: unknown;
}

export interface TaskToolInput {
  goal?: string;
  description?: string;
  [key: string]: unknown;
}

export interface MCPToolInput {
  [key: string]: unknown;
}

// Tool result types
export interface BashToolResult {
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  [key: string]: unknown;
}

export interface EditToolResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface WriteToolResult {
  success?: boolean;
  path?: string;
  [key: string]: unknown;
}

// Union type for all tool inputs
export type ToolInput =
  | BashToolInput
  | EditToolInput
  | WriteToolInput
  | TodoWriteToolInput
  | TaskToolInput
  | MCPToolInput;

// Union type for all tool results
export type ToolResult =
  | BashToolResult
  | EditToolResult
  | WriteToolResult
  | unknown;

// Tool call message
export interface ToolCallMessage extends BaseMessage {
  kind: 'tool-call';
  tool: {
    name: string;
    state: ToolState;
    input: Record<string, unknown>;
    description?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: unknown;  // Result when tool completes
  };
  permission?: {
    id: string;
    status: PermissionStatus;
    reason?: string;
    mode?: string;
    allowedTools?: string[];
    decision?: PermissionDecision;
    date?: number;
  };
  // Chat display (simplified)
  summary?: string;
  // Full data (for desktop or /full command)
  fullData?: Record<string, unknown>;
}

// Tool result message
export interface ToolResultMessage extends BaseMessage {
  kind: 'tool-result';
  toolUseId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
  timestamp: number;
  // Chat display summary
  summary?: string;
  // Full output (for desktop)
  fullOutput?: string;
}

// Permission request message
export interface PermissionMessage extends BaseMessage {
  kind: 'permission';
  permission: {
    id: string;
    toolName: string;
    input: Record<string, unknown>;
    status: PermissionStatus;
    reason?: string;
    mode?: string;
    allowedTools?: string[];
  };
  // Available actions for user
  actions?: Array<{
    command: string;
    label: string;
  }>;
}

// Event message
export interface EventMessage extends BaseMessage {
  kind: 'event';
  event: {
    type: 'ready' | 'mode_switch' | 'context_reset' | 'compaction' | 'error';
    data?: Record<string, unknown>;
    message?: string;
  };
}

// Error message
export interface ErrorMessage extends BaseMessage {
  kind: 'error';
  error: {
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  };
  recoverable?: boolean;
}

// Union type of all messages
export type Message =
  | UserTextMessage
  | AgentTextMessage
  | ToolCallMessage
  | ToolResultMessage
  | PermissionMessage
  | EventMessage
  | ErrorMessage;

// Type guards
export function isUserTextMessage(msg: Message): msg is UserTextMessage {
  return msg.kind === 'user-text';
}

export function isAgentTextMessage(msg: Message): msg is AgentTextMessage {
  return msg.kind === 'agent-text';
}

export function isToolCallMessage(msg: Message): msg is ToolCallMessage {
  return msg.kind === 'tool-call';
}

export function isToolResultMessage(msg: Message): msg is ToolResultMessage {
  return msg.kind === 'tool-result';
}

export function isPermissionMessage(msg: Message): msg is PermissionMessage {
  return msg.kind === 'permission';
}

export function isEventMessage(msg: Message): msg is EventMessage {
  return msg.kind === 'event';
}

export function isErrorMessage(msg: Message): msg is ErrorMessage {
  return msg.kind === 'error' && msg.isError !== false;
}
