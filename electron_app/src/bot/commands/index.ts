/**
 * Bot Command Index
 *
 * Exports the command registry with all registered commands
 */

import type { CommandHandler } from './handler';
import { CommandRegistry } from './handler';
import { commandParser } from './parser';
import {
  statusCommand,
  historyCommand,
  switchCommand,
  clearCommand,
  modelCommand,
  trustCommand
} from './builtin';

const helpCommand: CommandHandler = {
  name: 'help',
  description: '显示帮助信息',
  usage: '/help [command]',
  async execute() {
    return {
      success: true,
      message: getCommandHelpText()
    };
  }
};

export const commandRegistry = new CommandRegistry();
export { commandParser };

// Register all built-in commands
commandRegistry.register(statusCommand);
commandRegistry.register(historyCommand);
commandRegistry.register(switchCommand);
commandRegistry.register(clearCommand);
commandRegistry.register(modelCommand);
commandRegistry.register(trustCommand);
commandRegistry.register(helpCommand);

/**
 * Get help text for all commands
 */
export function getCommandHelpText(): string {
  // Use the registry's built-in help text
  const registryHelp = commandRegistry.getHelpText();

  // Add special service-level commands that are handled differently
  const additionalCommands = [
    '',
    '🔧 权限控制:',
    '/approve - 批准待处理的权限请求',
    '/deny - 拒绝待处理的权限请求',
    '',
    '📊 消息查看:',
    '/full <id> - 查看工具调用的完整输出'
  ].join('\n');

  return registryHelp + additionalCommands;
}
