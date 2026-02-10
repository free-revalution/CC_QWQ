// electron_app/src/bot/adapters/whatsapp.ts
import { Client, LocalAuth } from 'whatsapp-web.js';
import { BotMessage, BotNotification } from '../../types/bot';
import { BotAdapter } from './base';
import * as qrcode from 'qrcode-terminal';

/**
 * WhatsApp adapter using whatsapp-web.js
 * Provides WhatsApp Web integration with QR code authentication
 */
export class WhatsAppAdapter extends BotAdapter {
  private client: Client | null = null;
  private authorizedNumbers: Set<string> = new Set();
  private isInitializing: boolean = false;

  /**
   * Connect to WhatsApp Web using QR code authentication
   * @param config - Configuration object with optional sessionPath and authorizedNumbers
   * @throws Error if initialization fails
   */
  async connect(config: Record<string, unknown>): Promise<void> {
    if (this.client || this.isInitializing) {
      throw new Error('WhatsApp client is already initialized or initializing');
    }

    this.isInitializing = true;
    this.authorizedNumbers = new Set(config.authorizedNumbers as string[] || []);

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.sessionPath as string || './.wwebjs_auth'
        })
      });

      // Set up event handlers before initialization
      this.setupEventHandlers();

      await this.client.initialize();
    } catch (error) {
      this.isInitializing = false;
      this.client = null;
      throw new Error(`Failed to initialize WhatsApp client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Set up all event handlers for the WhatsApp client
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.connected = true;
    });

    this.client.on('auth_failure', (error) => {
      console.error('WhatsApp authentication failed:', error);
      this.connected = false;
      throw new Error(`WhatsApp authentication failed: ${error}`);
    });

    this.client.on('message', (msg) => {
      try {
        const botMsg: BotMessage = {
          platform: 'whatsapp',
          userId: msg.from,
          chatId: msg.from,
          content: msg.body,
          timestamp: Date.now()
        };

        if (this.verifyUser(msg.from)) {
          this.emitMessage(botMsg);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      this.connected = false;
    });
  }

  /**
   * Disconnect from WhatsApp Web and clean up resources
   * Removes all event listeners to prevent memory leaks
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.client.removeAllListeners();
        await this.client.destroy();
      } catch (error) {
        console.error('Error during disconnect:', error);
      } finally {
        this.client = null;
        this.connected = false;
      }
    }
  }

  /**
   * Send a message to a WhatsApp chat
   * @param chatId - The WhatsApp chat ID (e.g., '1234567890@c.us')
   * @param content - The message content to send
   * @throws Error if client is not connected or sending fails
   */
  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('WhatsApp client is not connected. Please connect first.');
    }

    try {
      await this.client.sendMessage(chatId, content);
    } catch (error) {
      throw new Error(`Failed to send WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a formatted notification to a WhatsApp chat
   * @param chatId - The WhatsApp chat ID
   * @param notification - The notification object with type, title, message, and optional actions
   * @throws Error if sending fails
   */
  async sendNotification(chatId: string, notification: BotNotification): Promise<void> {
    try {
      const icon = this.getNotificationIcon(notification.type);
      let message = `${icon} ${notification.title}\n\n${notification.message}`;

      if (notification.actions && notification.actions.length > 0) {
        message += '\n\n可用操作:\n';
        notification.actions.forEach(action => {
          message += `• ${action.label}: ${action.command}\n`;
        });
      }

      await this.sendMessage(chatId, message);
    } catch (error) {
      throw new Error(`Failed to send WhatsApp notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify if a user is authorized to interact with the bot
   * @param userId - The WhatsApp user ID (e.g., '1234567890@c.us')
   * @returns true if the user is authorized, false otherwise
   */
  verifyUser(userId: string): boolean {
    try {
      const phoneNumber = userId.replace('@c.us', '').replace('@s.whatsapp.net', '');

      // If no authorized numbers are configured, allow all users
      if (this.authorizedNumbers.size === 0) {
        return true;
      }

      return this.authorizedNumbers.has(phoneNumber);
    } catch (error) {
      console.error('Error verifying user:', error);
      return false;
    }
  }

  /**
   * Get the appropriate emoji icon for a notification type
   * @param type - The notification type
   * @returns The emoji icon for the notification type
   */
  private getNotificationIcon(type: BotNotification['type']): string {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type];
  }

  /**
   * Add a phone number to the authorized list
   * @param phoneNumber - The phone number to authorize (without @c.us suffix)
   */
  addAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.add(phoneNumber);
  }

  /**
   * Remove a phone number from the authorized list
   * @param phoneNumber - The phone number to remove (without @c.us suffix)
   */
  removeAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.delete(phoneNumber);
  }

  /**
   * Get all authorized phone numbers
   * @returns Array of authorized phone numbers
   */
  getAuthorizedNumbers(): string[] {
    return Array.from(this.authorizedNumbers);
  }
}
