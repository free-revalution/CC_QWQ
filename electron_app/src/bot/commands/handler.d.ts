import type { CommandContext, CommandResult } from '../../types/bot';
export interface CommandHandler {
    name: string;
    description: string;
    usage: string;
    execute(context: CommandContext): Promise<CommandResult>;
}
export declare class CommandRegistry {
    private handlers;
    register(handler: CommandHandler): void;
    get(name: string): CommandHandler | undefined;
    has(name: string): boolean;
    list(): CommandHandler[];
    getHelpText(): string;
}
