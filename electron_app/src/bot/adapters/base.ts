import { BotMessage, BotNotification } from '../../types/bot';

export abstract class BotAdapter {
  protected connected = false;
  protected messageCallbacks: Array<(msg: BotMessage) => void> = [];

  abstract connect(config: Record<string, unknown>): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(chatId: string, content: string): Promise<void>;
  abstract sendNotification(chatId: string, notification: BotNotification): Promise<void>;
  abstract verifyUser(userId: string): boolean;

  isConnected(): boolean {
    return this.connected;
  }

  onMessage(callback: (msg: BotMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  protected emitMessage(message: BotMessage): void {
    this.messageCallbacks.forEach(cb => cb(message));
  }

  getPlatformName(): string {
    return this.constructor.name.replace('Adapter', '').toLowerCase();
  }
}
