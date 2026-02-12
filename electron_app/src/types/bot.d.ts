/**
 * 用于定义机器人在不同平台上的消息和通知类型
 */
export interface BotMessage {
    platform: 'whatsapp' | 'feishu';
    userId: string;
    chatId: string;
    content: string;
    timestamp: number;
}
export interface BotNotification {
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    actions?: Array<{
        label: string;
        command: string;
    }>;
}
export interface CommandContext {
    message: BotMessage;
    platform: 'whatsapp' | 'feishu';
    args: string[];
    conversationId?: string;
    projectPath?: string;
    ipc?: typeof import('../lib/ipc').ipc;
}
export interface CommandResult {
    success: boolean;
    message: string;
    data?: unknown;
}
export interface BotMetrics {
    whatsappConnected: boolean;
    feishuConnected: boolean;
    messagesReceived: number;
    messagesSent: number;
    averageResponseTime: number;
    errorCount: number;
    lastErrorTime: number;
}
