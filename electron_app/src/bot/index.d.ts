import { BotAdapter } from './adapters/base';
import type { BotMessage, BotNotification, BotMetrics } from '../types/bot';
interface BotConfig {
    whatsapp?: {
        enabled: boolean;
        sessionPath?: string;
        authorizedNumbers?: string[];
    };
    feishu?: {
        enabled: boolean;
        appId: string;
        appSecret: string;
        authorizedUsers?: string[];
        authorizedGroups?: string[];
    };
}
export declare class BotManager {
    private adapters;
    private messageHandlers;
    private metrics;
    /**
     * Initialize the BotManager with the provided configuration.
     * Connects to enabled platforms and sets up message handlers.
     * @param config - Configuration for WhatsApp and/or Feishu platforms
     * @throws Error if any enabled platform fails to connect
     */
    initialize(config: BotConfig): Promise<void>;
    private setupAdapter;
    /**
     * Register a message handler to receive messages from all connected platforms.
     * @param handler - Function to call when a message is received
     */
    onMessage(handler: (msg: BotMessage) => void): void;
    /**
     * Remove a previously registered message handler.
     * @param handler - The handler function to remove
     * @returns true if the handler was found and removed, false otherwise
     */
    removeMessageHandler(handler: (msg: BotMessage) => void): boolean;
    /**
     * Send a message to a specific platform and chat.
     * @param platform - The platform to send to ('whatsapp' or 'feishu')
     * @param chatId - The chat ID to send the message to
     * @param content - The message content
     * @throws Error if the platform is not connected or sending fails
     */
    sendMessage(platform: string, chatId: string, content: string): Promise<void>;
    /**
     * Send a structured notification to a specific platform and chat.
     * @param platform - The platform to send to ('whatsapp' or 'feishu')
     * @param chatId - The chat ID to send the notification to
     * @param notification - The notification object to send
     * @throws Error if the platform is not connected or sending fails
     */
    sendNotification(platform: string, chatId: string, notification: BotNotification): Promise<void>;
    /**
     * Get a specific adapter instance.
     * @param platform - The platform name ('whatsapp' or 'feishu')
     * @returns The adapter instance or undefined if not found
     */
    getAdapter(platform: string): BotAdapter | undefined;
    /**
     * Get current metrics for all platforms.
     * @returns A copy of the current metrics object
     */
    getMetrics(): BotMetrics;
    /**
     * Check if a specific platform is connected.
     * @param platform - The platform name ('whatsapp' or 'feishu')
     * @returns true if the platform is connected, false otherwise
     */
    isPlatformConnected(platform: string): boolean;
    /**
     * Get a list of all connected platform names.
     * @returns Array of connected platform names
     */
    getConnectedPlatforms(): string[];
    private updateMetrics;
    /**
     * Shutdown all connected platforms and clean up resources.
     */
    shutdown(): Promise<void>;
}
export declare const botManager: BotManager;
export {};
