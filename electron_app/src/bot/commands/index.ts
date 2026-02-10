// electron_app/src/bot/commands/index.ts
import { CommandHandler, CommandRegistry } from './handler';
import { CommandContext } from '../../types/bot';

const statusCommand: CommandHandler = {
  name: 'status',
  description: '查看当前系统状态',
  usage: '/status',
  async execute(context: CommandContext) {
    return {
      success: true,
      message: '状态信息获取成功',
      data: {
        platform: context.message.platform,
        timestamp: Date.now()
      }
    };
  }
};

const helpCommand: CommandHandler = {
  name: 'help',
  description: '显示帮助信息',
  usage: '/help [command]',
  async execute(context: CommandContext) {
    return {
      success: true,
      message: '帮助信息'
    };
  }
};

export const commandRegistry = new CommandRegistry();
commandRegistry.register(statusCommand);
commandRegistry.register(helpCommand);
