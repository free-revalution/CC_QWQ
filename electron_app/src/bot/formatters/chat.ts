/**
 * Chat Message Formatter
 *
 * Formats messages for display in chat platforms (WhatsApp, Feishu)
 * based on Happy's design principles.
 */

import type { Message, ToolCallMessage, PermissionMessage } from '../types/messages';
import {
  isUserTextMessage, isAgentTextMessage, isToolCallMessage,
  isToolResultMessage, isPermissionMessage, isEventMessage, isErrorMessage
} from '../types/messages';
import { formatToolForChat, formatToolStateChange } from '../tools/registry';

// Platform-specific limits
const WHATSAPP_LIMIT = 4096;
const FEISHU_LIMIT = 10000;

export interface FormatOptions {
  platform: 'whatsapp' | 'feishu';
  compact?: boolean;        // Use compact mode
  includeTimestamp?: boolean;
  maxOutputLength?: number;
}

/**
 * Format a message for chat display
 */
export function formatMessageForChat(message: Message, options: FormatOptions): string {
  switch (message.kind) {
    case 'user-text':
      return formatUserMessage(message, options);

    case 'agent-text':
      return formatAgentMessage(message, options);

    case 'tool-call':
      return formatToolCallMessage(message, options);

    case 'tool-result':
      return formatToolResultMessage(message, options);

    case 'permission':
      return formatPermissionMessage(message, options);

    case 'event':
      return formatEventMessage(message, options);

    case 'error':
      return formatErrorMessage(message, options);

    default:
      // Exhaustiveness check - TypeScript should never reach here
      return `❓ 未知消息类型: ${(message as Message).kind}`;
  }
}

/**
 * Format user message
 */
function formatUserMessage(message: Message, options: FormatOptions): string {
  if (!isUserTextMessage(message)) return '';

  if (options.compact) {
    return `👤 ${message.content.substring(0, 100)}...`;
  }

  return `👤 ${message.content}`;
}

/**
 * Format agent text message
 */
function formatAgentMessage(message: Message, options: FormatOptions): string {
  if (!isAgentTextMessage(message)) return '';

  let output = '';

  // Streaming indicator
  if (message.isStreaming) {
    output += `🤖 [AI 思考中...]\n\n`;
  }

  // Content
  output += message.content;

  // Metadata footer
  if (!options.compact && message.metadata) {
    output += '\n\n━━━━━━━━━━━━━━';
    if (message.metadata.model) {
      output += `\n📊 模型: ${message.metadata.model}`;
    }
    if (message.metadata.tokensUsed) {
      output += ` | 用量: ${message.metadata.tokensUsed} tokens`;
    }
  } else if (!message.isStreaming) {
    output += `\n\n✅ 回复完成`;
  }

  return truncateIfNeeded(output, options);
}

/**
 * Format tool call message
 */
function formatToolCallMessage(message: Message, options: FormatOptions): string {
  if (!isToolCallMessage(message)) return '';

  const tool = message.tool;
  let output = '';

  // Summary line
  output += message.summary || formatToolForChat(tool);

  // State
  if (tool.state === 'running') {
    const duration = tool.startedAt ?
      `[${formatDuration(tool.startedAt)}]` : '';
    output += `\n⏳ 运行中... ${duration}`;
  } else if (tool.state === 'completed') {
    output += `\n${formatToolStateChange(tool)}`;
  } else if (tool.state === 'error') {
    output += `\n${formatToolStateChange(tool)}`;
  }

  // Permission info (if pending)
  if (message.permission?.status === 'pending') {
    output += `\n\n⏳ 等待批准...`;
    output += `\n回复 /approve 批准`;
    output += `\n回复 /deny 拒绝`;
  }

  return truncateIfNeeded(output, options);
}

/**
 * Format tool result message
 */
function formatToolResultMessage(message: Message, options: FormatOptions): string {
  if (!isToolResultMessage(message)) return '';

  let output = '';

  if (message.isError) {
    output += `❌ 工具执行错误\n`;
    output += `工具: ${message.toolName}\n`;
  } else {
    output += `✅ 工具执行完成\n`;
    output += `工具: ${message.toolName}\n`;
  }

  // Show summary if available
  if (message.summary) {
    output += `\n${message.summary}`;
  }

  // If output is long, show truncation notice
  if (message.fullOutput) {
    const outputLen = message.fullOutput.length;
    const maxLength = options.platform === 'whatsapp' ? 500 : 2000;

    if (outputLen > maxLength) {
      output += `\n\n┌────────────────────┐`;
      output += `\n│ 输出过长 (${outputLen} 字符)  │`;
      output += `\n│ 回复 /full 查看完整输出 │`;
      output += `\n└────────────────────┘`;
    }
  }

  return truncateIfNeeded(output, options);
}

/**
 * Format permission message
 */
function formatPermissionMessage(message: Message, options: FormatOptions): string {
  if (!isPermissionMessage(message)) return '';

  const perm = message.permission;
  let text = `🔔 权限请求\n\n`;
  text += `工具: ${perm.toolName}\n`;

  // Format input
  const input = JSON.stringify(perm.input, null, 2);
  const maxLength = options.platform === 'whatsapp' ? 200 : 500;
  const shortInput = input.length > maxLength ?
    input.substring(0, maxLength) + '\n...' : input;
  text += `\n详情:\n${shortInput}\n`;

  // Actions
  if (message.actions && message.actions.length > 0) {
    text += `\n可用操作:\n`;
    message.actions.forEach(action => {
      text += `• ${action.label}: ${action.command}\n`;
    });
  }

  return truncateIfNeeded(text, options);
}

/**
 * Format event message
 */
function formatEventMessage(message: Message, _options: FormatOptions): string {
  if (!isEventMessage(message)) return '';

  const event = message.event;

  switch (event.type) {
    case 'ready':
      return `✅ Claude Code 已就绪`;

    case 'mode_switch':
      return `🔄 模式切换: ${event.data?.mode || event.message || ''}`;

    case 'context_reset':
      return `🔄 上下文已重置`;

    case 'compaction':
      return `📝 对话已压缩`;

    case 'error':
      return `❌ 错误: ${event.message || event.data || ''}`;

    default:
      if (event.message) {
        return `ℹ️ ${event.message}`;
      }
      return `ℹ️ 事件: ${event.type}`;
  }
}

/**
 * Format error message
 */
function formatErrorMessage(message: Message, options: FormatOptions): string {
  if (!isErrorMessage(message)) return '';

  let output = '❌ 错误\n';
  output += `${message.error.message}\n`;

  if (message.error.details) {
    output += `\n详情: ${JSON.stringify(message.error.details, null, 2)}`;
  }

  if (message.recoverable) {
    output += `\n💡 此错误可以恢复`;
  }

  return truncateIfNeeded(output, options);
}

/**
 * Format multiple messages for batch display
 */
export function formatMessagesForChat(messages: Message[], options: FormatOptions): string[] {
  const formatted: string[] = [];
  let currentBatch = '';

  for (const message of messages) {
    const msgFormatted = formatMessageForChat(message, options);
    const limit = options.platform === 'whatsapp' ? WHATSAPP_LIMIT : FEISHU_LIMIT;

    // If adding this message would exceed limit, start new batch
    if (currentBatch.length + msgFormatted.length > limit) {
      if (currentBatch) {
        formatted.push(currentBatch);
      }
      currentBatch = msgFormatted;
    } else {
      currentBatch += (currentBatch ? '\n\n' : '') + msgFormatted;
    }
  }

  if (currentBatch) {
    formatted.push(currentBatch);
  }

  return formatted;
}

/**
 * Format permission request specifically for chat
 */
export function formatPermissionRequest(permission: PermissionMessage, platform: 'whatsapp' | 'feishu'): string {
  const perm = permission.permission;
  let text = `🔔 *权限请求*\n\n`;
  text += `**工具:** \`${perm.toolName}\`\n`;

  const input = JSON.stringify(perm.input, null, 2);
  const maxLen = platform === 'whatsapp' ? 150 : 300;
  const shortInput = input.length > maxLen ? input.substring(0, maxLen) + '...' : input;

  text += `**详情:** \n\`\`\n${shortInput}\n\`\`\n`;

  if (perm.status === 'pending') {
    text += `\n回复 _/approve_ 批准`;
    text += `\n回复 _/deny_ 拒绝`;
  } else if (perm.status === 'approved') {
    text += `\n✅ 已批准`;
  } else if (perm.status === 'denied') {
    text += `\n❌ 已拒绝`;
  }

  return text;
}

/**
 * Format tool execution result
 */
export function formatToolExecutionResult(tool: ToolCallMessage['tool'], _platform: 'whatsapp' | 'feishu', result?: any): string {
  let output = '';

  if (tool.state === 'completed') {
    output += `✅ *${tool.name}* 完成`;
  } else if (tool.state === 'error') {
    output += `❌ *${tool.name}* 错误`;
  } else {
    output += `⏳ *${tool.name}* 运行中...`;
  }

  // Add timing
  if (tool.startedAt && tool.completedAt) {
    const duration = tool.completedAt - tool.startedAt;
    output += ` [${formatDurationMs(duration)}]`;
  }

  // Add brief result (if provided separately)
  if (result) {
    const summary = formatResultSummary(result, 200);
    if (summary) {
      output += `\n\n${summary}`;
    }
  }

  return output;
}

//
// Helper functions
//

function truncateIfNeeded(text: string, options: FormatOptions): string {
  const limit = options.maxOutputLength ||
    (options.platform === 'whatsapp' ? WHATSAPP_LIMIT : FEISHU_LIMIT);

  if (text.length <= limit) {
    return text;
  }

  return text.substring(0, limit - 3) + '...';
}

function formatDuration(start: number): string {
  const now = Date.now();
  const diff = now - start;

  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  return `${Math.floor(diff / 60000)}m`;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

function formatResultSummary(result: any, maxLength: number): string | null {
  if (typeof result === 'string') {
    return result.length > maxLength ? result.substring(0, maxLength) + '...' : result;
  }

  if (result && typeof result === 'object') {
    // Handle structured results
    if (result.stdout) {
      return formatResultSummary(result.stdout, maxLength);
    }
    if (result.error) {
      return `错误: ${result.error}`;
    }
    const str = JSON.stringify(result, null, 2);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }

  return null;
}

/**
 * Get command help text
 */
export function getCommandHelpText(): string {
  return `📖 *可用命令*

_/status_ - 查看当前状态
_/switch <id>_ - 切换对话
_/history_ - 查看历史记录
_/full <msgid>_ - 查看工具完整输出
_/approve_ - 批准权限请求
_/deny_ - 拒绝权限请求
_/help_ - 显示此帮助信息`;
}
