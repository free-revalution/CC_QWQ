/**
 * Bot Message Service
 *
 * Core service that coordinates between BotManager, CommandSystem, and ClaudeIntegration
 * to handle message flow from chat platforms to Claude Code and back.
 */

import type { BotMessage } from '../../types/bot';
import { botManager } from '../index';
import { commandParser, commandRegistry } from '../commands';
import { whatsappIntegration, feishuIntegration } from '../integration/claude';

export interface BotServiceConfig {
  whatsapp?: {
    enabled: boolean;
    conversationId: string;
    projectPath: string;
  };
  feishu?: {
    enabled: boolean;
    conversationId: string;
    projectPath: string;
  };
}

export interface ConversationState {
  id: string;
  projectPath: string;
  platform: 'whatsapp' | 'feishu';
  chatId: string;
  isActive: boolean;
}

/**
 * Main service for handling bot message flow
 */
export class BotMessageService {
  private conversations: Map<string, ConversationState> = new Map();
  private messageHandler: ((msg: BotMessage) => void) | null = null;

  /**
   * Initialize the bot service with configuration
   */
  async initialize(config: BotServiceConfig): Promise<void> {
    // Initialize bot manager
    await botManager.initialize({
      whatsapp: config.whatsapp?.enabled ? { enabled: true } : undefined,
      feishu: config.feishu?.enabled ? { enabled: true, appId: '', appSecret: '' } : undefined
    });

    // Set up conversation tracking
    if (config.whatsapp?.enabled) {
      this.conversations.set('whatsapp-default', {
        id: config.whatsapp.conversationId,
        projectPath: config.whatsapp.projectPath,
        platform: 'whatsapp',
        chatId: 'default',
        isActive: true
      });
      whatsappIntegration.setConversation(config.whatsapp.conversationId, config.whatsapp.projectPath);
    }

    if (config.feishu?.enabled) {
      this.conversations.set('feishu-default', {
        id: config.feishu.conversationId,
        projectPath: config.feishu.projectPath,
        platform: 'feishu',
        chatId: 'default',
        isActive: true
      });
      feishuIntegration.setConversation(config.feishu.conversationId, config.feishu.projectPath);
    }

    // Set up message handler
    this.setupMessageHandler();

    console.log('BotMessageService initialized');
  }

  /**
   * Set up message handler from BotManager
   */
  private setupMessageHandler(): void {
    this.messageHandler = async (msg: BotMessage) => {
      await this.handleIncomingMessage(msg);
    };
    botManager.onMessage(this.messageHandler);
  }

  /**
   * Handle incoming message from chat platform
   */
  private async handleIncomingMessage(msg: BotMessage): Promise<void> {
    try {
      console.log(`[${msg.platform}] Received from ${msg.userId}:`, msg.content);

      // Parse command
      const parsed = commandParser.parse(msg);

      if (parsed.isCommand) {
        await this.handleCommand(msg, parsed);
      } else {
        await this.handleClaudeMessage(msg);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      await this.sendErrorMessage(msg.platform, msg.chatId, `处理消息时出错: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * Handle command message
   */
  private async handleCommand(msg: BotMessage, parsed: ReturnType<typeof commandParser.parse>): Promise<void> {
    if (!parsed.isCommand || !parsed.command) return;

    const command = commandRegistry.get(parsed.command);

    if (command) {
      // Execute registered command
      const context = {
        message: msg,
        platform: msg.platform,
        args: parsed.args
      };

      const result = await command.execute(context);

      if (result.success) {
        await botManager.sendMessage(msg.platform, msg.chatId, result.message || '命令执行成功');
      } else {
        await botManager.sendMessage(msg.platform, msg.chatId, result.message || '命令执行失败');
      }
    } else {
      // Handle service-level commands (approve, deny, full)
      await this.handleServiceCommand(msg, parsed.command, parsed.args);
    }
  }

  /**
   * Handle service-level commands (permission control, message viewing)
   */
  private async handleServiceCommand(msg: BotMessage, command: string, args: string[]): Promise<void> {
    switch (command) {
      case 'approve':
        await this.handlePermissionApproval(msg, true);
        break;

      case 'deny':
        await this.handlePermissionApproval(msg, false);
        break;

      case 'full':
        await this.handleFullCommand(msg, args[0]);
        break;

      default:
        await botManager.sendMessage(msg.platform, msg.chatId, `未知命令: /${command}\n输入 /help 查看可用命令`);
    }
  }

  /**
   * Handle permission approval/denial
   */
  private async handlePermissionApproval(msg: BotMessage, approved: boolean): Promise<void> {
    const integration = msg.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;

    // Get pending permissions for current conversation
    const pendingPerms = integration.getPendingPermissions();

    if (pendingPerms.length === 0) {
      await botManager.sendMessage(msg.platform, msg.chatId, '没有待处理的权限请求');
      return;
    }

    // Handle the most recent permission
    const perm = pendingPerms[pendingPerms.length - 1];
    await integration.respondToPermission(perm.id, approved ? 'approve' : 'deny');

    await botManager.sendMessage(msg.platform, msg.chatId, approved ? '✅ 权限已批准' : '❌ 权限已拒绝');
  }

  /**
   * Handle /full command - show full tool output
   */
  private async handleFullCommand(msg: BotMessage, messageId: string): Promise<void> {
    if (!messageId) {
      await botManager.sendMessage(msg.platform, msg.chatId, '用法: /full <消息ID>');
      return;
    }

    const integration = msg.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;
    const message = integration.getMessages().find(m => m.id === messageId);

    if (!message) {
      await botManager.sendMessage(msg.platform, msg.chatId, `消息 ${messageId} 不存在`);
      return;
    }

    if (message.kind === 'tool-call' && message.tool.result) {
      let output = `📊 ${message.tool.name} 完整输出\n\n`;
      output += JSON.stringify(message.tool.result, null, 2);
      await botManager.sendMessage(msg.platform, msg.chatId, output);
    } else if (message.kind === 'tool-result' && message.fullOutput) {
      await botManager.sendMessage(msg.platform, msg.chatId, message.fullOutput);
    } else {
      await botManager.sendMessage(msg.platform, msg.chatId, `消息 ${messageId} 没有完整输出`);
    }
  }

  /**
   * Handle message to Claude Code
   */
  private async handleClaudeMessage(msg: BotMessage): Promise<void> {
    const integration = msg.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;

    // Send to Claude Code
    await integration.sendMessage(msg.content);

    // Wait for response (streaming will be handled by IPC listener)
    // For now, just acknowledge
    console.log(`[${msg.platform}] Sent to Claude Code, waiting for response...`);
  }

  /**
   * Send error message to chat
   */
  private async sendErrorMessage(platform: 'whatsapp' | 'feishu', chatId: string, message: string): Promise<void> {
    try {
      await botManager.sendMessage(platform, chatId, `❌ ${message}`);
    } catch (error) {
      console.error('Failed to send error message:', error);
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.messageHandler) {
      botManager.removeMessageHandler(this.messageHandler);
      this.messageHandler = null;
    }

    await botManager.shutdown();
    console.log('BotMessageService shut down');
  }

  /**
   * Get current conversations
   */
  getConversations(): ConversationState[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get active conversation for platform
   */
  getActiveConversation(platform: 'whatsapp' | 'feishu'): ConversationState | undefined {
    return Array.from(this.conversations.values()).find(c => c.platform === platform && c.isActive);
  }
}

// Global service instance
export const botMessageService = new BotMessageService();
