/**
 * Reducer State Management
 *
 * Manages message processing state, deduplication, and tracking.
 */

import type { Message, PermissionMessage } from './messages';

export interface PermissionData {
  toolName: string;
  input: Record<string, unknown>;
  createdAt: number;
  completedAt?: number;
  status: 'pending' | 'approved' | 'denied' | 'canceled';
  reason?: string;
  mode?: string;
  allowedTools?: string[];
  decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
}

export interface ReducerState {
  // Message deduplication tracking
  localIds: Map<string, string>;        // localId -> messageId
  messageIds: Map<string, string>;       // messageId -> messageId

  // Permission and tool association
  toolIdToMessageId: Map<string, string>;  // toolId/permissionId -> messageId
  pendingPermissions: Map<string, PermissionData>;

  // Sidechain (sub-conversation) handling
  sidechains: Map<string, Message[]>;    // toolId -> child messages

  // Current messages
  messages: Map<string, Message>;

  // Conversation context
  currentConversation?: string;

  // Metrics
  metrics: {
    messagesProcessed: number;
    errors: number;
    lastUpdate: number;
  };
}

export interface ReducerResult {
  newMessages: Message[];
  permissions: PermissionMessage[];
  hasChanges: boolean;
  metrics?: {
    messagesProcessed: number;
    errors: number;
  };
}

export function createReducer(): ReducerState {
  return {
    localIds: new Map(),
    messageIds: new Map(),
    toolIdToMessageId: new Map(),
    pendingPermissions: new Map(),
    sidechains: new Map(),
    messages: new Map(),
    metrics: {
      messagesProcessed: 0,
      errors: 0,
      lastUpdate: Date.now()
    }
  };
}
