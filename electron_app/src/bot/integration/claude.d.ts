/**
 * Claude Code Integration for Bot System
 * 中文：与 Claude Code 交互的集成模块
 *
 * Bridges the bot message system with Claude Code IPC.
 * 中文：通过 IPC 与 Claude Code 交互的模块
 */
import type { Message } from '../types/messages';
/**
 * Claude Integration Configuration
 * 中文：与 Claude Code 交互的配置项
 */
export interface ClaudeIntegrationConfig {
    conversationId: string;
    projectPath: string;
    platform: 'whatsapp' | 'feishu';
}
/**
 * Extended permission data with conversation context
 */
interface PendingPermissionData {
    conversationId: string;
    toolName: string;
    input: Record<string, unknown>;
    createdAt: number;
    expiresAt: number;
}
export declare class ClaudeIntegration {
    private state;
    private currentConversation;
    private currentProject;
    private platform;
    private permissionTimeoutMs;
    private cleanupInterval;
    constructor(platform: 'whatsapp' | 'feishu');
    /**
     * Send a message to Claude Code
     */
    sendMessage(message: string): Promise<Message[]>;
    /**
     * Process incoming Claude stream
     */
    processStream(data: unknown): Promise<Message[]>;
    /**
     * Send permission notification to chat
     */
    private sendPermissionNotification;
    /**
     * Respond to permission request
     */
    respondToPermission(permissionId: string, decision: 'approve' | 'deny'): Promise<void>;
    /**
     * Get pending permissions with conversation context
     */
    getPendingPermissions(): Array<{
        id: string;
        data: PendingPermissionData;
    }>;
    /**
     * Start cleanup interval for expired permissions
     */
    private startCleanupInterval;
    /**
     * Cleanup method to stop intervals (for shutdown)
     */
    dispose(): void;
    /**
     * Get messages for display
     */
    getMessages(limit?: number): Message[];
    /**
     * Set current conversation
     */
    setConversation(conversationId: string, projectPath: string): void;
    /**
     * Get current conversation info
     */
    getCurrentConversation(): {
        id: string;
        projectPath: string;
    } | null;
    /**
     * Format permission message for chat
     */
    private formatPermissionMessage;
}
export declare const whatsappIntegration: ClaudeIntegration;
export declare const feishuIntegration: ClaudeIntegration;
export {};
