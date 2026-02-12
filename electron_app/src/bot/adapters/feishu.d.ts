import type { BotNotification } from '../../types/bot';
import { BotAdapter } from './base';
/**
 * Feishu adapter using Feishu Open Platform API
 * Provides webhook-based integration with Feishu (Lark) messaging platform
 */
export declare class FeishuAdapter extends BotAdapter {
    private config;
    private authorizedUsers;
    private authorizedGroups;
    private isInitializing;
    /**
     * Connect to Feishu Open Platform with webhook configuration
     * @param config - Configuration object with appId, appSecret, and optional settings
     * @throws Error if configuration is invalid or initialization fails
     */
    connect(config: Record<string, unknown>): Promise<void>;
    /**
     * Validate the configuration object
     * @param config - Configuration object to validate
     * @returns Validated configuration
     * @throws Error if required fields are missing or invalid
     */
    private validateConfig;
    /**
     * Disconnect from Feishu and clean up resources
     * Clears configuration and authorization lists
     */
    disconnect(): Promise<void>;
    /**
     * Send a message to a Feishu chat
     * @param chatId - The Feishu chat ID (e.g., 'oc_xxxxxxxxxxxxxxxx')
     * @param content - The message content to send
     * @throws Error if adapter is not connected
     */
    sendMessage(chatId: string, content: string): Promise<void>;
    /**
     * Send a formatted notification to a Feishu chat
     * @param chatId - The Feishu chat ID
     * @param notification - The notification object with type, title, message, and optional actions
     * @throws Error if sending fails
     */
    sendNotification(chatId: string, notification: BotNotification): Promise<void>;
    /**
     * Verify if a user is authorized to interact with the bot
     * @param userId - The Feishu user ID (e.g., 'ou_xxxxxxxxxxxxxxxx')
     * @returns true if the user is authorized, false otherwise
     */
    verifyUser(userId: string): boolean;
    /**
     * Verify if a group is authorized to interact with the bot
     * @param groupId - The Feishu group ID (e.g., 'oc_xxxxxxxxxxxxxxxx')
     * @returns true if the group is authorized, false otherwise
     */
    verifyGroup(groupId: string): boolean;
    /**
     * Get the appropriate emoji icon for a notification type
     * @param type - The notification type
     * @returns The emoji icon for the notification type
     */
    private getNotificationIcon;
    /**
     * Add a user ID to the authorized list
     * @param userId - The Feishu user ID to authorize
     */
    addAuthorizedUser(userId: string): void;
    /**
     * Remove a user ID from the authorized list
     * @param userId - The Feishu user ID to remove
     */
    removeAuthorizedUser(userId: string): void;
    /**
     * Get all authorized user IDs
     * @returns Array of authorized user IDs
     */
    getAuthorizedUsers(): string[];
    /**
     * Add a group ID to the authorized list
     * @param groupId - The Feishu group ID to authorize
     */
    addAuthorizedGroup(groupId: string): void;
    /**
     * Remove a group ID from the authorized list
     * @param groupId - The Feishu group ID to remove
     */
    removeAuthorizedGroup(groupId: string): void;
    /**
     * Get all authorized group IDs
     * @returns Array of authorized group IDs
     */
    getAuthorizedGroups(): string[];
}
