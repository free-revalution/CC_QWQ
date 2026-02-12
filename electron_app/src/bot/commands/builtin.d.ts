/**
 * Built-in Bot Commands
 *
 * Core commands for the bot system
 */
import type { CommandHandler } from './handler';
/**
 * Status command - show system status
 */
export declare const statusCommand: CommandHandler;
/**
 * History command - show recent messages
 */
export declare const historyCommand: CommandHandler;
/**
 * Switch conversation command
 */
export declare const switchCommand: CommandHandler;
/**
 * Clear command - clear conversation context
 */
export declare const clearCommand: CommandHandler;
/**
 * Model command - switch Claude model
 */
export declare const modelCommand: CommandHandler;
/**
 * Trust command - trust a folder
 */
export declare const trustCommand: CommandHandler;
/**
 * Export all built-in commands
 */
export declare const builtinCommands: CommandHandler[];
