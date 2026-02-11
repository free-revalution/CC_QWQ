/**
 * Built-in Bot Commands
 *
 * Core commands for the bot system
 */

import type { CommandHandler } from './handler';
import { botManager } from '../index';
import { whatsappIntegration, feishuIntegration } from '../integration/claude';

/**
 * Status command - show system status
 */
export const statusCommand: CommandHandler = {
  name: 'status',
  description: '查看当前系统状态',
  usage: '/status',
  async execute(context) {
    const integration = context.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;
    const messages = integration.getMessages(10);

    let status = `📊 系统状态\n\n`;
    status += `平台: ${context.platform}\n`;
    status += `消息数: ${messages.length}\n`;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      status += `\n最近消息: ${lastMessage.kind}\n`;
      status += `时间: ${new Date(lastMessage.timestamp).toLocaleString()}\n`;
    }

    const metrics = botManager.getMetrics();
    status += `\n接收: ${metrics.messagesReceived} | 发送: ${metrics.messagesSent}`;
    if (metrics.errorCount > 0) {
      status += ` | 错误: ${metrics.errorCount}`;
    }

    return { success: true, message: status };
  }
};

/**
 * History command - show recent messages
 */
export const historyCommand: CommandHandler = {
  name: 'history',
  description: '查看最近的消息历史',
  usage: '/history [数量]',
  async execute(context) {
    const limit = context.args[0] ? parseInt(context.args[0], 10) : 5;
    const integration = context.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;
    const messages = integration.getMessages(Math.min(limit, 20));

    if (messages.length === 0) {
      return { success: true, message: '暂无消息历史' };
    }

    let output = `📜 最近 ${messages.length} 条消息:\n\n`;
    messages.forEach((msg, i) => {
      const prefix = msg.kind === 'user-text' ? '👤' :
                     msg.kind === 'agent-text' ? '🤖' :
                     msg.kind === 'tool-call' ? '🔧' :
                     msg.kind === 'permission' ? '🔔' : '📋';
      const time = new Date(msg.timestamp).toLocaleTimeString();
      output += `${i + 1}. ${prefix} [${time}] ${msg.kind}\n`;
    });

    return { success: true, message: output };
  }
};

/**
 * Switch conversation command
 */
export const switchCommand: CommandHandler = {
  name: 'switch',
  description: '切换对话',
  usage: '/switch <对话ID>',
  async execute(_context) {
    const conversationId = _context.args[0];

    if (!conversationId) {
      return { success: false, message: '请提供对话ID' };
    }

    // TODO: Implement conversation switching
    return {
      success: true,
      message: `切换到对话: ${conversationId}\n(功能待实现)`
    };
  }
};

/**
 * Clear command - clear conversation context
 */
export const clearCommand: CommandHandler = {
  name: 'clear',
  description: '清除对话上下文',
  usage: '/clear',
  async execute() {
    // TODO: Implement context clearing
    return {
      success: true,
      message: '对话上下文已清除\n(功能待实现)'
    };
  }
};

/**
 * Model command - switch Claude model
 */
export const modelCommand: CommandHandler = {
  name: 'model',
  description: '切换 Claude 模型',
  usage: '/model <模型ID>',
  async execute(context) {
    const modelId = context.args[0];

    if (!modelId) {
      return { success: false, message: '请提供模型ID (如 claude-opus-4-5)' };
    }

    const ipc = context.ipc;
    if (!ipc) {
      return { success: false, message: 'IPC 不可用' };
    }

    const result = await ipc.switchModel(modelId);
    if (result?.success) {
      return { success: true, message: `✅ 已切换到模型: ${modelId}` };
    }

    return { success: false, message: '切换模型失败' };
  }
};

/**
 * Trust command - trust a folder
 */
export const trustCommand: CommandHandler = {
  name: 'trust',
  description: '信任文件夹',
  usage: '/trust',
  async execute() {
    // TODO: Implement trust command properly
    return {
      success: true,
      message: '信任文件夹命令\n(功能待实现)'
    };
  }
};

/**
 * Export all built-in commands
 */
export const builtinCommands: CommandHandler[] = [
  statusCommand,
  historyCommand,
  switchCommand,
  clearCommand,
  modelCommand,
  trustCommand
];
