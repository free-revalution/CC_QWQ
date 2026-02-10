// electron_app/src/bot/adapters/feishu.ts
import { BotMessage, BotNotification } from '../../types/bot';
import { BotAdapter } from './base';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  authorizedUsers?: string[];
  authorizedGroups?: string[];
}

export class FeishuAdapter extends BotAdapter {
  private config: FeishuConfig;
  private webhookUrl: string | null = null;
  private authorizedUsers: Set<string> = new Set();
  private authorizedGroups: Set<string> = new Set();

  async connect(config: Record<string, unknown>): Promise<void> {
    this.config = config as FeishuConfig;
    this.authorizedUsers = new Set(this.config.authorizedUsers || []);
    this.authorizedGroups = new Set(this.config.authorizedGroups || []);

    console.log('Feishu adapter configured');
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.webhookUrl = null;
    this.connected = false;
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    console.log(`Sending message to Feishu ${chatId}:`, content);
  }

  async sendNotification(chatId: string, notification: BotNotification): Promise<void> {
    const icon = this.getNotificationIcon(notification.type);
    let content = `${icon} **${notification.title}**\n\n${notification.message}`;

    if (notification.actions && notification.actions.length > 0) {
      content += '\n\n**可用操作:**\n';
      notification.actions.forEach(action => {
        content += `• ${action.label}: \`${action.command}\`\n`;
      });
    }

    await this.sendMessage(chatId, content);
  }

  verifyUser(userId: string): boolean {
    if (this.authorizedUsers.size === 0 && this.authorizedGroups.size === 0) {
      return true;
    }

    return this.authorizedUsers.has(userId);
  }

  verifyGroup(groupId: string): boolean {
    if (this.authorizedGroups.size === 0) {
      return true;
    }

    return this.authorizedGroups.has(groupId);
  }

  private getNotificationIcon(type: BotNotification['type']): string {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type];
  }
}
