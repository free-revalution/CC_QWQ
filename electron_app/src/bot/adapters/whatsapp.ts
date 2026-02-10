// electron_app/src/bot/adapters/whatsapp.ts
import { Client, LocalAuth } from 'whatsapp-web.js';
import { BotMessage, BotNotification } from '../../types/bot';
import { BotAdapter } from './base';
import * as qrcode from 'qrcode-terminal';

export class WhatsAppAdapter extends BotAdapter {
  private client: Client | null = null;
  private config: Record<string, unknown> = {};
  private authorizedNumbers: Set<string> = new Set();

  async connect(config: Record<string, unknown>): Promise<void> {
    this.config = config;
    this.authorizedNumbers = new Set(config.authorizedNumbers as string[] || []);

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.sessionPath as string || './.wwebjs_auth'
      })
    });

    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.connected = true;
    });

    this.client.on('message', (msg) => {
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
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client disconnected:', reason);
      this.connected = false;
    });

    await this.client.initialize();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.connected = false;
    }
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    if (this.client && this.connected) {
      await this.client.sendMessage(chatId, content);
    }
  }

  async sendNotification(chatId: string, notification: BotNotification): Promise<void> {
    const icon = this.getNotificationIcon(notification.type);
    let message = `${icon} ${notification.title}\n\n${notification.message}`;

    if (notification.actions && notification.actions.length > 0) {
      message += '\n\n可用操作:\n';
      notification.actions.forEach(action => {
        message += `• ${action.label}: ${action.command}\n`;
      });
    }

    await this.sendMessage(chatId, message);
  }

  verifyUser(userId: string): boolean {
    const phoneNumber = userId.replace('@c.us', '').replace('@s.whatsapp.net', '');

    if (this.authorizedNumbers.size === 0) {
      return true;
    }

    return this.authorizedNumbers.has(phoneNumber);
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

  addAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.add(phoneNumber);
  }

  removeAuthorizedNumber(phoneNumber: string): void {
    this.authorizedNumbers.delete(phoneNumber);
  }

  getAuthorizedNumbers(): string[] {
    return Array.from(this.authorizedNumbers);
  }
}
