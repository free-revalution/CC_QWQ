import type { BotNotification } from '../../types/bot';
import { BotAdapter } from './base';
/**
 * WhatsApp adapter using whatsapp-web.js
 * Provides WhatsApp Web integration with QR code authentication
 */
export declare class WhatsAppAdapter extends BotAdapter {
    private client;
    private authorizedNumbers;
    private isInitializing;
    /**
     * Connect to WhatsApp Web using QR code authentication
     * @param config - Configuration object with optional sessionPath and authorizedNumbers
     * @throws Error if initialization fails
     */
    connect(config: Record<string, unknown>): Promise<void>;
    /**
     * Set up all event handlers for the WhatsApp client
     */
    private setupEventHandlers;
    /**
     * Disconnect from WhatsApp Web and clean up resources
     * Removes all event listeners to prevent memory leaks
     */
    disconnect(): Promise<void>;
    /**
     * Send a message to a WhatsApp chat
     * @param chatId - The WhatsApp chat ID (e.g., '1234567890@c.us')
     * @param content - The message content to send
     * @throws Error if client is not connected or sending fails
     */
    sendMessage(chatId: string, content: string): Promise<void>;
    /**
     * Send a formatted notification to a WhatsApp chat
     * @param chatId - The WhatsApp chat ID
     * @param notification - The notification object with type, title, message, and optional actions
     * @throws Error if sending fails
     */
    sendNotification(chatId: string, notification: BotNotification): Promise<void>;
    /**
     * Verify if a user is authorized to interact with the bot
     * @param userId - The WhatsApp user ID (e.g., '1234567890@c.us')
     * @returns true if the user is authorized, false otherwise
     */
    verifyUser(userId: string): boolean;
    /**
     * Get the appropriate emoji icon for a notification type
     * @param type - The notification type
     * @returns The emoji icon for the notification type
     */
    private getNotificationIcon;
    /**
     * Add a phone number to the authorized list
     * @param phoneNumber - The phone number to authorize (without @c.us suffix)
     */
    addAuthorizedNumber(phoneNumber: string): void;
    /**
     * Remove a phone number from the authorized list
     * @param phoneNumber - The phone number to remove (without @c.us suffix)
     */
    removeAuthorizedNumber(phoneNumber: string): void;
    /**
     * Get all authorized phone numbers
     * @returns Array of authorized phone numbers
     */
    getAuthorizedNumbers(): string[];
}
