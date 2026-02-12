/**
 * Happy 架构改进 - 消息类型定义
 *
 * 参考: https://github.com/slopus/happy
 */
import type { ClaudeToolType } from './index';
/**
 * 文本内容块
 */
export interface TextContent {
    type: 'text';
    text: string;
}
/**
 * 工具调用内容块（Claude 调用工具）
 */
export interface ToolUseContent {
    type: 'tool_use';
    id: string;
    name: ClaudeToolType;
    input: Record<string, unknown>;
    description?: string;
}
/**
 * 工具结果内容块（工具执行返回）
 */
export interface ToolResultContent {
    type: 'tool_result';
    tool_use_id: string;
    content: string | Array<{
        type: 'text';
        text: string;
    }>;
    is_error?: boolean;
    permissions?: {
        date: number;
        result: 'approved' | 'denied';
        mode?: string;
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
    };
}
/**
 * 消息内容块类型
 */
export type MessageContent = TextContent | ToolUseContent | ToolResultContent;
/**
 * 工具调用状态
 */
export type ToolCallState = 'running' | 'completed' | 'error' | 'pending';
/**
 * 权限决策信息
 */
export interface ToolPermission {
    id: string;
    status: 'pending' | 'approved' | 'denied' | 'canceled';
    reason?: string;
    mode?: string;
    allowedTools?: string[];
    decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
    date?: number;
}
/**
 * 工具调用接口
 */
export interface ToolCall {
    name: ClaudeToolType;
    state: ToolCallState;
    input: Record<string, unknown>;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    description: string | null;
    result?: unknown;
    permission?: ToolPermission;
}
/**
 * 消息类型（用于前端渲染分发）
 */
export type MessageKind = 'user-text' | 'agent-text' | 'tool-call' | 'mode-switch';
/**
 * 消息元数据
 */
export interface MessageMeta {
    sentFrom?: 'desktop' | 'mobile' | 'web';
    permissionMode?: 'default' | 'auto-approve' | 'strict';
    model?: string;
    displayText?: string;
}
/**
 * 用户文本消息
 */
export interface UserTextMessage {
    kind: 'user-text';
    id: string;
    localId: string | null;
    createdAt: number;
    text: string;
    displayText?: string;
    meta?: MessageMeta;
}
/**
 * AI 文本消息
 */
export interface AgentTextMessage {
    kind: 'agent-text';
    id: string;
    localId: string | null;
    createdAt: number;
    text: string;
    meta?: MessageMeta;
}
/**
 * 工具调用消息
 */
export interface ToolCallMessage {
    kind: 'tool-call';
    id: string;
    localId: string | null;
    createdAt: number;
    tool: ToolCall;
    children: Message[];
    meta?: MessageMeta;
}
/**
 * 模式切换事件（AgentEvent）
 */
export interface AgentEvent {
    type: 'switch' | 'message' | 'limit-reached' | 'ready';
    mode?: 'local' | 'remote';
    message?: string;
    endsAt?: number;
}
/**
 * 模式切换消息
 */
export interface ModeSwitchMessage {
    kind: 'mode-switch';
    id: string;
    createdAt: number;
    event: AgentEvent;
    meta?: MessageMeta;
}
/**
 * 联合消息类型
 */
export type Message = UserTextMessage | AgentTextMessage | ToolCallMessage | ModeSwitchMessage;
/**
 * 使用量统计
 */
export interface UsageData {
    input_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens: number;
    service_tier?: string;
}
/**
 * 增强的消息接口
 */
export interface EnhancedMessage {
    id: string;
    localId?: string;
    createdAt: number;
    role: 'user' | 'assistant' | 'system';
    content: MessageContent[];
    meta?: MessageMeta;
    usage?: UsageData;
}
/**
 * WebSocket 更新类型
 */
export type WSUpdateType = 'new-message' | 'update-message' | 'conversation-list' | 'session-state' | 'activity';
/**
 * 实时活动状态更新
 */
export interface ActivityUpdate {
    type: 'activity';
    sessionId: string;
    active: boolean;
    activeAt: number;
    thinking?: boolean;
    thinkingAt?: number;
}
/**
 * 会话状态更新
 */
export interface SessionStateUpdate {
    type: 'session-state';
    sessionId: string;
    claudeStatus: 'not_started' | 'initializing' | 'ready';
    controlledByUser: boolean;
    lastMessage?: Message;
    updatedAt: number;
}
/**
 * 消息更新（工具状态变化）
 */
export interface MessageUpdate {
    type: 'update-message';
    sessionId: string;
    messageId: string;
    content: MessageContent;
    updatedAt: number;
}
/**
 * 会话状态
 */
export interface SessionState {
    sessionId: string;
    claudeStatus: 'not_started' | 'initializing' | 'ready';
    controlledByUser: boolean;
    activeToolCalls: Map<string, ToolCall>;
    lastActivity: number;
    thinking: boolean;
    thinkingAt: number;
    activeAt: number;
}
