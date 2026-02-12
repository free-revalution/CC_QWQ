/**
 * Bot Command Index
 *
 * Exports the command registry with all registered commands
 */
import { CommandRegistry } from './handler';
import { commandParser } from './parser';
export declare const commandRegistry: CommandRegistry;
export { commandParser };
/**
 * Get help text for all commands
 */
export declare function getCommandHelpText(): string;
