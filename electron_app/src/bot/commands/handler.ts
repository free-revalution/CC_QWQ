// electron_app/src/bot/commands/handler.ts
import { CommandContext, CommandResult } from '../../types/bot';

export interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  execute(context: CommandContext): Promise<CommandResult>;
}

export class CommandRegistry {
  private handlers: Map<string, CommandHandler> = new Map();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.name, handler);
  }

  get(name: string): CommandHandler | undefined {
    return this.handlers.get(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): CommandHandler[] {
    return Array.from(this.handlers.values());
  }

  getHelpText(): string {
    const lines = ['📖 可用命令:\n'];

    this.handlers.forEach(handler => {
      lines.push(`**/${handler.name}** - ${handler.description}`);
      lines.push(`  用法: ${handler.usage}`);
      lines.push('');
    });

    return lines.join('\n');
  }
}
