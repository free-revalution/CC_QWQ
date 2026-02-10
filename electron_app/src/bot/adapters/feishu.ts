// electron_app/src/bot/adapters/feishu.ts
import type { BotNotification } from '../../types/bot';
import { BotAdapter } from './base';

/**
 * Configuration interface for Feishu adapter
 */
interface FeishuConfig {
  /** Feishu App ID from developer console */
  appId: string;
  /** Feishu App Secret from developer console */
  appSecret: string;
  /** Optional encryption key for webhook verification */
  encryptKey?: string;
  /** Optional verification token for webhook */
  verificationToken?: string;
  /** Optional list of authorized user IDs */
  authorizedUsers?: string[];
  /** Optional list of authorized group IDs */
  authorizedGroups?: string[];
}

/**
 * Feishu adapter using Feishu Open Platform API
 * Provides webhook-based integration with Feishu (Lark) messaging platform
 */
export class FeishuAdapter extends BotAdapter {
  private config: FeishuConfig | null = null;
  private authorizedUsers: Set<string> = new Set();
  private authorizedGroups: Set<string> = new Set();
  private isInitializing: boolean = false;

  /**
   * Connect to Feishu Open Platform with webhook configuration
   * @param config - Configuration object with appId, appSecret, and optional settings
   * @throws Error if configuration is invalid or initialization fails
   */
  async connect(config: Record<string, unknown>): Promise<void> {
    if (this.config || this.isInitializing) {
      throw new Error('Feishu adapter is already initialized or initializing');
    }

    this.isInitializing = true;

    try {
      // Validate required configuration
      const validatedConfig = this.validateConfig(config);
      this.config = validatedConfig;

      // Set up authorization lists
      this.authorizedUsers = new Set(this.config.authorizedUsers || []);
      this.authorizedGroups = new Set(this.config.authorizedGroups || []);

      console.log('Feishu adapter configured successfully');
      this.connected = true;
    } catch (error) {
      this.config = null;
      this.connected = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Validate the configuration object
   * @param config - Configuration object to validate
   * @returns Validated configuration
   * @throws Error if required fields are missing or invalid
   */
  private validateConfig(config: Record<string, unknown>): FeishuConfig {
    if (!config.appId || typeof config.appId !== 'string') {
      throw new Error('Feishu configuration must include a valid appId (string)');
    }

    if (!config.appSecret || typeof config.appSecret !== 'string') {
      throw new Error('Feishu configuration must include a valid appSecret (string)');
    }

    const validatedConfig: FeishuConfig = {
      appId: config.appId,
      appSecret: config.appSecret
    };

    // Optional fields
    if (config.encryptKey && typeof config.encryptKey === 'string') {
      validatedConfig.encryptKey = config.encryptKey;
    }

    if (config.verificationToken && typeof config.verificationToken === 'string') {
      validatedConfig.verificationToken = config.verificationToken;
    }

    if (config.authorizedUsers && Array.isArray(config.authorizedUsers)) {
      validatedConfig.authorizedUsers = config.authorizedUsers.filter(
        (id): id is string => typeof id === 'string'
      );
    }

    if (config.authorizedGroups && Array.isArray(config.authorizedGroups)) {
      validatedConfig.authorizedGroups = config.authorizedGroups.filter(
        (id): id is string => typeof id === 'string'
      );
    }

    return validatedConfig;
  }

  /**
   * Disconnect from Feishu and clean up resources
   * Clears configuration and authorization lists
   */
  async disconnect(): Promise<void> {
    try {
      this.config = null;
      this.authorizedUsers.clear();
      this.authorizedGroups.clear();
    } catch (error) {
      console.error('Error during Feishu disconnect:', error);
    } finally {
      this.connected = false;
    }
  }

  /**
   * Send a message to a Feishu chat
   * @param chatId - The Feishu chat ID (e.g., 'oc_xxxxxxxxxxxxxxxx')
   * @param content - The message content to send
   * @throws Error if adapter is not connected
   */
  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.config || !this.connected) {
      throw new Error('Feishu adapter is not connected. Please connect first.');
    }

    try {
      // Placeholder implementation - logs to console
      // In production, this would make an API call to Feishu
      console.log(`Sending message to Feishu chat ${chatId}:`, content);
    } catch (error) {
      throw new Error(`Failed to send Feishu message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a formatted notification to a Feishu chat
   * @param chatId - The Feishu chat ID
   * @param notification - The notification object with type, title, message, and optional actions
   * @throws Error if sending fails
   */
  async sendNotification(chatId: string, notification: BotNotification): Promise<void> {
    try {
      const icon = this.getNotificationIcon(notification.type);
      let content = `${icon} **${notification.title}**\n\n${notification.message}`;

      if (notification.actions && notification.actions.length > 0) {
        content += '\n\n**可用操作:**\n';
        notification.actions.forEach(action => {
          content += `• ${action.label}: \`${action.command}\`\n`;
        });
      }

      await this.sendMessage(chatId, content);
    } catch (error) {
      throw new Error(`Failed to send Feishu notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify if a user is authorized to interact with the bot
   * @param userId - The Feishu user ID (e.g., 'ou_xxxxxxxxxxxxxxxx')
   * @returns true if the user is authorized, false otherwise
   */
  verifyUser(userId: string): boolean {
    try {
      // If no authorized users are configured, allow all users
      if (this.authorizedUsers.size === 0 && this.authorizedGroups.size === 0) {
        return true;
      }

      return this.authorizedUsers.has(userId);
    } catch (error) {
      console.error('Error verifying Feishu user:', error);
      return false;
    }
  }

  /**
   * Verify if a group is authorized to interact with the bot
   * @param groupId - The Feishu group ID (e.g., 'oc_xxxxxxxxxxxxxxxx')
   * @returns true if the group is authorized, false otherwise
   */
  verifyGroup(groupId: string): boolean {
    try {
      // If no authorized groups are configured, allow all groups
      if (this.authorizedGroups.size === 0) {
        return true;
      }

      return this.authorizedGroups.has(groupId);
    } catch (error) {
      console.error('Error verifying Feishu group:', error);
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
   * Add a user ID to the authorized list
   * @param userId - The Feishu user ID to authorize
   */
  addAuthorizedUser(userId: string): void {
    this.authorizedUsers.add(userId);
  }

  /**
   * Remove a user ID from the authorized list
   * @param userId - The Feishu user ID to remove
   */
  removeAuthorizedUser(userId: string): void {
    this.authorizedUsers.delete(userId);
  }

  /**
   * Get all authorized user IDs
   * @returns Array of authorized user IDs
   */
  getAuthorizedUsers(): string[] {
    return Array.from(this.authorizedUsers);
  }

  /**
   * Add a group ID to the authorized list
   * @param groupId - The Feishu group ID to authorize
   */
  addAuthorizedGroup(groupId: string): void {
    this.authorizedGroups.add(groupId);
  }

  /**
   * Remove a group ID from the authorized list
   * @param groupId - The Feishu group ID to remove
   */
  removeAuthorizedGroup(groupId: string): void {
    this.authorizedGroups.delete(groupId);
  }

  /**
   * Get all authorized group IDs
   * @returns Array of authorized group IDs
   */
  getAuthorizedGroups(): string[] {
    return Array.from(this.authorizedGroups);
  }
}
