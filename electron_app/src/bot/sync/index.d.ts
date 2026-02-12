/**
 * Bot State Synchronization
 *
 * Handles bidirectional synchronization between chat platforms and desktop.
 * Syncs messages, conversation state, and permissions.
 */
import type { BotMessage } from '../../types/bot';
export interface SyncConfig {
    /** Sync interval in milliseconds (0 for event-only) */
    syncInterval?: number;
    /** Maximum messages to sync per batch */
    maxMessages?: number;
    /** Whether to sync conversation list */
    syncConversations?: boolean;
}
export interface SyncState {
    lastSyncTime: number;
    lastMessageId: string | null;
    conversationsSynced: number;
    messagesSynced: number;
    errors: number;
}
export declare class BotStateSync {
    private config;
    private state;
    private syncIntervals;
    private streamCleanupId;
    constructor(config?: SyncConfig);
    private createSyncState;
    /**
     * Start synchronization for a platform
     */
    start(platform: 'whatsapp' | 'feishu'): Promise<void>;
    /**
     * Stop synchronization for a platform
     */
    stop(platform: 'whatsapp' | 'feishu'): void;
    /**
     * Stop all synchronization
     */
    stopAll(): void;
    /**
     * Set up Claude stream listener for real-time sync
     */
    private setupStreamListener;
    /**
     * Handle incoming Claude stream data
     */
    private handleClaudeStream;
    /**
     * Format Claude stream data for chat display
     */
    private formatStreamMessage;
    /**
     * Sync messages from desktop to chat platform
     */
    private syncToChat;
    /**
     * Format message for chat display
     */
    private formatMessageForChat;
    /**
     * Sync chat message to desktop
     */
    syncFromChat(botMessage: BotMessage): Promise<void>;
    /**
     * Get sync state for a platform
     */
    getSyncState(platform: 'whatsapp' | 'feishu'): SyncState | undefined;
    /**
     * Get all sync states
     */
    getAllSyncStates(): Map<'whatsapp' | 'feishu', SyncState>;
    /**
     * Reset sync state for a platform
     */
    resetSyncState(platform: 'whatsapp' | 'feishu'): void;
    /**
     * Reset all sync states
     */
    resetAllSyncStates(): void;
}
export declare const botStateSync: BotStateSync;
