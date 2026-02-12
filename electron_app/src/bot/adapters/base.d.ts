import type { BotMessage, BotNotification } from '../../types/bot';
export declare abstract class BotAdapter {
    protected connected: boolean;
    protected messageCallbacks: Array<(msg: BotMessage) => void>;
    abstract connect(config: Record<string, unknown>): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract sendMessage(chatId: string, content: string): Promise<void>;
    abstract sendNotification(chatId: string, notification: BotNotification): Promise<void>;
    abstract verifyUser(userId: string): boolean;
    isConnected(): boolean;
    onMessage(callback: (msg: BotMessage) => void): void;
    protected emitMessage(message: BotMessage): void;
    getPlatformName(): string;
}
