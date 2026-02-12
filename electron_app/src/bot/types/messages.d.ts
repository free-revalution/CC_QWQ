/**
 * Message Type System for CC QwQ Bot Integration
 *
 * Based on Happy's flattened message architecture where each message
 * represents a single content block.
 */
export type BotMessageKind = 'user-text' | 'agent-text' | 'tool-call' | 'tool-result' | 'permission' | 'event' | 'error';
export interface BaseMessage {
    id: string;
    kind: BotMessageKind;
    timestamp: number;
    platform: 'whatsapp' | 'feishu';
    conversationId: string;
}
export interface UserTextMessage extends BaseMessage {
    kind: 'user-text';
    content: string;
    displayText?: string;
    localId?: string;
}
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
export type ToolState = 'running' | 'completed' | 'error';
export type PermissionStatus = 'pending' | 'approved' | 'denied' | 'canceled';
export type PermissionDecision = 'approved' | 'approved_for_session' | 'denied' | 'abort';
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
        result?: unknown;
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
    summary?: string;
    fullData?: Record<string, unknown>;
}
export interface ToolResultMessage extends BaseMessage {
    kind: 'tool-result';
    toolUseId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
    timestamp: number;
    summary?: string;
    fullOutput?: string;
}
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
    actions?: Array<{
        command: string;
        label: string;
    }>;
}
export interface EventMessage extends BaseMessage {
    kind: 'event';
    event: {
        type: 'ready' | 'mode_switch' | 'context_reset' | 'compaction' | 'error';
        data?: Record<string, unknown>;
        message?: string;
    };
}
export interface ErrorMessage extends BaseMessage {
    kind: 'error';
    error: {
        code?: string;
        message: string;
        details?: Record<string, unknown>;
    };
    recoverable?: boolean;
}
export type Message = UserTextMessage | AgentTextMessage | ToolCallMessage | ToolResultMessage | PermissionMessage | EventMessage | ErrorMessage;
export declare function isUserTextMessage(msg: Message): msg is UserTextMessage;
export declare function isAgentTextMessage(msg: Message): msg is AgentTextMessage;
export declare function isToolCallMessage(msg: Message): msg is ToolCallMessage;
export declare function isToolResultMessage(msg: Message): msg is ToolResultMessage;
export declare function isPermissionMessage(msg: Message): msg is PermissionMessage;
export declare function isEventMessage(msg: Message): msg is EventMessage;
export declare function isErrorMessage(msg: Message): msg is ErrorMessage;
