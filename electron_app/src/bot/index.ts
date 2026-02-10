// electron_app/src/bot/index.ts
import { BotAdapter } from './adapters/base';
import { WhatsAppAdapter } from './adapters/whatsapp';
import { FeishuAdapter } from './adapters/feishu';
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

export class BotManager {
  private adapters: Map<string, BotAdapter> = new Map();
  private messageHandlers: Array<(msg: BotMessage) => void> = [];
  private metrics: BotMetrics = {
    whatsappConnected: false,
    feishuConnected: false,
    messagesReceived: 0,
    messagesSent: 0,
    averageResponseTime: 0,
    errorCount: 0,
    lastErrorTime: 0
  };

  /**
   * Initialize the BotManager with the provided configuration.
   * Connects to enabled platforms and sets up message handlers.
   * @param config - Configuration for WhatsApp and/or Feishu platforms
   * @throws Error if any enabled platform fails to connect
   */
  async initialize(config: BotConfig): Promise<void> {
    const initializedAdapters: Array<{ name: string; adapter: BotAdapter }> = [];

    try {
      if (config.whatsapp?.enabled) {
        const whatsapp = new WhatsAppAdapter();
        await whatsapp.connect(config.whatsapp);
        initializedAdapters.push({ name: 'whatsapp', adapter: whatsapp });
      }

      if (config.feishu?.enabled) {
        const feishu = new FeishuAdapter();
        await feishu.connect(config.feishu);
        initializedAdapters.push({ name: 'feishu', adapter: feishu });
      }

      // Only set up adapters if all connections succeeded
      for (const { name, adapter } of initializedAdapters) {
        this.setupAdapter(name, adapter);
      }
    } catch (error) {
      // Clean up any successfully connected adapters before throwing
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = Date.now();

      for (const { adapter } of initializedAdapters) {
        try {
          await adapter.disconnect();
        } catch (cleanupError) {
          console.warn('Failed to cleanup adapter during initialize error:', cleanupError);
        }
      }

      throw new Error(`Failed to initialize bot platform: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private setupAdapter(name: string, adapter: BotAdapter): void {
    adapter.onMessage((msg) => {
      this.metrics.messagesReceived++;
      this.messageHandlers.forEach(handler => {
        try {
          handler(msg);
        } catch (error) {
          console.error(`Error in message handler for ${name}:`, error);
          this.metrics.errorCount++;
          this.metrics.lastErrorTime = Date.now();
        }
      });
    });

    this.adapters.set(name, adapter);
    this.updateMetrics();
  }

  /**
   * Register a message handler to receive messages from all connected platforms.
   * @param handler - Function to call when a message is received
   */
  onMessage(handler: (msg: BotMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Remove a previously registered message handler.
   * @param handler - The handler function to remove
   * @returns true if the handler was found and removed, false otherwise
   */
  removeMessageHandler(handler: (msg: BotMessage) => void): boolean {
    const index = this.messageHandlers.indexOf(handler);
    if (index !== -1) {
      this.messageHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Send a message to a specific platform and chat.
   * @param platform - The platform to send to ('whatsapp' or 'feishu')
   * @param chatId - The chat ID to send the message to
   * @param content - The message content
   * @throws Error if the platform is not connected or sending fails
   */
  async sendMessage(platform: string, chatId: string, content: string): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      const error = `Platform '${platform}' is not connected or does not exist`;
      console.warn(`[BotManager] ${error}`);
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = Date.now();
      throw new Error(error);
    }

    try {
      await adapter.sendMessage(chatId, content);
      this.metrics.messagesSent++;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = Date.now();
      throw error;
    }
  }

  /**
   * Send a structured notification to a specific platform and chat.
   * @param platform - The platform to send to ('whatsapp' or 'feishu')
   * @param chatId - The chat ID to send the notification to
   * @param notification - The notification object to send
   * @throws Error if the platform is not connected or sending fails
   */
  async sendNotification(platform: string, chatId: string, notification: BotNotification): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      const error = `Platform '${platform}' is not connected or does not exist`;
      console.warn(`[BotManager] ${error}`);
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = Date.now();
      throw new Error(error);
    }

    try {
      await adapter.sendNotification(chatId, notification);
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = Date.now();
      throw error;
    }
  }

  /**
   * Get a specific adapter instance.
   * @param platform - The platform name ('whatsapp' or 'feishu')
   * @returns The adapter instance or undefined if not found
   */
  getAdapter(platform: string): BotAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get current metrics for all platforms.
   * @returns A copy of the current metrics object
   */
  getMetrics(): BotMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if a specific platform is connected.
   * @param platform - The platform name ('whatsapp' or 'feishu')
   * @returns true if the platform is connected, false otherwise
   */
  isPlatformConnected(platform: string): boolean {
    const adapter = this.adapters.get(platform);
    return adapter?.isConnected() || false;
  }

  /**
   * Get a list of all connected platform names.
   * @returns Array of connected platform names
   */
  getConnectedPlatforms(): string[] {
    return Array.from(this.adapters.entries())
      .filter(([, adapter]) => adapter.isConnected())
      .map(([name]) => name);
  }

  private updateMetrics(): void {
    this.metrics.whatsappConnected = this.isPlatformConnected('whatsapp');
    this.metrics.feishuConnected = this.isPlatformConnected('feishu');
  }

  /**
   * Shutdown all connected platforms and clean up resources.
   */
  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        await adapter.disconnect();
      } catch (error) {
        console.warn('Error disconnecting adapter:', error);
        this.metrics.errorCount++;
        this.metrics.lastErrorTime = Date.now();
      }
    });

    await Promise.all(disconnectPromises);
    this.adapters.clear();
    this.messageHandlers = [];
    this.updateMetrics();
  }
}

export const botManager = new BotManager();
