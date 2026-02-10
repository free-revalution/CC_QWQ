// electron_app/src/bot/index.ts
import { BotAdapter } from './adapters/base';
import { WhatsAppAdapter } from './adapters/whatsapp';
import { FeishuAdapter } from './adapters/feishu';
import { BotMessage, BotNotification, BotMetrics } from '../types/bot';

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

  async initialize(config: BotConfig): Promise<void> {
    if (config.whatsapp?.enabled) {
      const whatsapp = new WhatsAppAdapter();
      await whatsapp.connect(config.whatsapp);
      this.setupAdapter('whatsapp', whatsapp);
    }

    if (config.feishu?.enabled) {
      const feishu = new FeishuAdapter();
      await feishu.connect(config.feishu);
      this.setupAdapter('feishu', feishu);
    }
  }

  private setupAdapter(name: string, adapter: BotAdapter): void {
    adapter.onMessage((msg) => {
      this.metrics.messagesReceived++;
      this.messageHandlers.forEach(handler => handler(msg));
    });

    this.adapters.set(name, adapter);
    this.updateMetrics();
  }

  onMessage(handler: (msg: BotMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(platform: string, chatId: string, content: string): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (adapter) {
      await adapter.sendMessage(chatId, content);
      this.metrics.messagesSent++;
    }
  }

  async sendNotification(platform: string, chatId: string, notification: BotNotification): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (adapter) {
      await adapter.sendNotification(chatId, notification);
    }
  }

  getAdapter(platform: string): BotAdapter | undefined {
    return this.adapters.get(platform);
  }

  getMetrics(): BotMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    this.metrics.whatsappConnected = this.adapters.get('whatsapp')?.isConnected() || false;
    this.metrics.feishuConnected = this.adapters.get('feishu')?.isConnected() || false;
  }

  async shutdown(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }
}

export const botManager = new BotManager();
