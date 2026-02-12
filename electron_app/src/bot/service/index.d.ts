/**
 * Bot Message Service
 *
 * Core service that coordinates between BotManager, CommandSystem, and ClaudeIntegration
 * to handle message flow from chat platforms to Claude Code and back.
 */
export interface BotServiceConfig {
    whatsapp?: {
        enabled: boolean;
        conversationId: string;
        projectPath: string;
    };
    feishu?: {
        enabled: boolean;
        conversationId: string;
        projectPath: string;
    };
}
export interface ConversationState {
    id: string;
    projectPath: string;
    platform: 'whatsapp' | 'feishu';
    chatId: string;
    isActive: boolean;
}
/**
 * Main service for handling bot message flow
 */
export declare class BotMessageService {
    private conversations;
    private messageHandler;
    /**
     * Initialize the bot service with configuration
     */
    initialize(config: BotServiceConfig): Promise<void>;
    /**
     * Set up message handler from BotManager
     */
    private setupMessageHandler;
    /**
     * Handle incoming message from chat platform
     */
    private handleIncomingMessage;
    /**
     * Handle command message
     */
    private handleCommand;
    /**
     * Handle service-level commands (permission control, message viewing)
     */
    private handleServiceCommand;
    /**
     * Handle permission approval/denial
     */
    private handlePermissionApproval;
    /**
     * Handle /full command - show full tool output
     */
    private handleFullCommand;
    /**
     * Handle message to Claude Code
     */
    private handleClaudeMessage;
    /**
     * Send error message to chat
     */
    private sendErrorMessage;
    /**
     * Shutdown the service
     */
    shutdown(): Promise<void>;
    /**
     * Get current conversations
     */
    getConversations(): ConversationState[];
    /**
     * Get active conversation for platform
     */
    getActiveConversation(platform: 'whatsapp' | 'feishu'): ConversationState | undefined;
}
export declare const botMessageService: BotMessageService;
