import type { BotAdapter } from '../bot/adapters/base';

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
  platform: BotAdapter;
  conversationId?: string;
  projectPath?: string;
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
