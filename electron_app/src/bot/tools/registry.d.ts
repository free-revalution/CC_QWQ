/**
 * Tool View Formatter Registry
 *
 * Based on Happy's tool view system, each tool has a dedicated formatter
 * that generates appropriate display text for chat platforms.
 */
import type { ToolCallMessage } from '../types/messages';
export interface ToolViewFormatter {
    formatSummary(tool: ToolCallMessage['tool']): string;
    formatStateChange(tool: ToolCallMessage['tool']): string;
    formatDetail(tool: ToolCallMessage['tool']): string;
    needsDesktopHandling?(tool: ToolCallMessage['tool']): boolean;
    shouldTruncate?(tool: ToolCallMessage['tool'], outputLength: number): boolean;
    extractKeyInfo?(tool: ToolCallMessage['tool']): Record<string, unknown>;
}
export declare const toolViewRegistry: Record<string, ToolViewFormatter>;
/**
 * Get formatter for a tool
 */
export declare function getToolFormatter(toolName: string): ToolViewFormatter;
/**
 * Format tool for chat display
 */
export declare function formatToolForChat(tool: ToolCallMessage['tool']): string;
/**
 * Format tool state change for notification
 */
export declare function formatToolStateChange(tool: ToolCallMessage['tool']): string;
/**
 * Format tool detail (for /full command or desktop)
 */
export declare function formatToolDetail(tool: ToolCallMessage['tool']): string;
/**
 * Check if tool needs desktop handling
 */
export declare function needsDesktopHandling(tool: ToolCallMessage['tool']): boolean;
/**
 * Check if output should be truncated
 */
export declare function shouldTruncateOutput(tool: ToolCallMessage['tool'], outputLength: number): boolean;
/**
 * Extract key info from tool
 */
export declare function extractToolKeyInfo(tool: ToolCallMessage['tool']): Record<string, unknown> | null;
