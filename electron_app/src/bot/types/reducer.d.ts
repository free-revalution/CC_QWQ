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
    localIds: Map<string, string>;
    messageIds: Map<string, string>;
    toolIdToMessageId: Map<string, string>;
    pendingPermissions: Map<string, PermissionData>;
    sidechains: Map<string, Message[]>;
    messages: Map<string, Message>;
    currentConversation?: string;
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
export declare function createReducer(): ReducerState;
