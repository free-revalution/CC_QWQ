/**
 * Chat Message Formatter
 *
 * Formats messages for display in chat platforms (WhatsApp, Feishu)
 * based on Happy's design principles.
 */
import type { Message, ToolCallMessage, PermissionMessage } from '../types/messages';
export interface FormatOptions {
    platform: 'whatsapp' | 'feishu';
    compact?: boolean;
    includeTimestamp?: boolean;
    maxOutputLength?: number;
}
/**
 * Format a message for chat display
 */
export declare function formatMessageForChat(message: Message, options: FormatOptions): string;
/**
 * Format multiple messages for batch display
 */
export declare function formatMessagesForChat(messages: Message[], options: FormatOptions): string[];
/**
 * Format permission request specifically for chat
 */
export declare function formatPermissionRequest(permission: PermissionMessage, platform: 'whatsapp' | 'feishu'): string;
/**
 * Format tool execution result
 */
export declare function formatToolExecutionResult(tool: ToolCallMessage['tool'], _platform: 'whatsapp' | 'feishu', result?: unknown): string;
/**
 * Get command help text
 */
export declare function getCommandHelpText(): string;
