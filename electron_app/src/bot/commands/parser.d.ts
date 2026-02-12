import type { BotMessage } from '../../types/bot';
export interface ParsedCommand {
    isCommand: boolean;
    command?: string;
    args: string[];
    originalMessage: string;
}
export declare class CommandParser {
    private commandPrefix;
    parse(message: BotMessage): ParsedCommand;
    setCommandPrefix(prefix: string): void;
    getCommandPrefix(): string;
}
export declare const commandParser: CommandParser;
