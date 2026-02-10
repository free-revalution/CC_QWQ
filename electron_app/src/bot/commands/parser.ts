// electron_app/src/bot/commands/parser.ts
import { BotMessage } from '../../types/bot';

export interface ParsedCommand {
  isCommand: boolean;
  command?: string;
  args: string[];
  originalMessage: string;
}

export class CommandParser {
  private commandPrefix = '/';

  parse(message: BotMessage): ParsedCommand {
    const content = message.content.trim();

    if (!content.startsWith(this.commandPrefix)) {
      return {
        isCommand: false,
        args: [],
        originalMessage: content
      };
    }

    const parts = content.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    return {
      isCommand: true,
      command,
      args,
      originalMessage: content
    };
  }

  setCommandPrefix(prefix: string): void {
    this.commandPrefix = prefix;
  }

  getCommandPrefix(): string {
    return this.commandPrefix;
  }
}

export const commandParser = new CommandParser();
