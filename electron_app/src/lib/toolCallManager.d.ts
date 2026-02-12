/**
 * ToolCallManager - 工具调用状态管理器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 负责跟踪 Claude Code 工具调用的完整生命周期：
 * pending → running → completed/error
 */
import type { ToolCall, ToolCallState, ToolPermission } from '../types/message';
import type { ClaudeToolType } from '../types';
/**
 * 工具调用管理器
 */
export declare class ToolCallManager {
    private calls;
    /**
     * 创建新的工具调用
     */
    create(id: string, name: ClaudeToolType, input: Record<string, unknown>): ToolCall;
    /**
     * 更新工具调用状态
     */
    updateState(id: string, state: ToolCallState, result?: unknown): void;
    /**
     * 设置权限信息
     */
    setPermission(id: string, permission: ToolPermission): void;
    /**
     * 获取工具调用
     */
    get(id: string): ToolCall | undefined;
    /**
     * 获取所有工具调用
     */
    getAll(): ToolCall[];
    /**
     * 获取指定状态的工具调用
     */
    getByState(state: ToolCallState): ToolCall[];
    /**
     * 获取运行中的工具调用
     */
    getRunning(): ToolCall[];
    /**
     * 获取待处理的工具调用（包括 pending 和等待权限的）
     */
    getPending(): ToolCall[];
    /**
     * 移除工具调用
     */
    remove(id: string): boolean;
    /**
     * 清空所有工具调用
     */
    clear(): void;
    /**
     * 提取可读描述
     */
    private extractDescription;
}
/**
 * 全局单例
 */
export declare const toolCallManager: ToolCallManager;
