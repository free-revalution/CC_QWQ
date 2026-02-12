/**
 * SessionStateManager - 会话状态管理器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 负责管理会话的实时状态，包括：
 * - Claude 状态 (not_started / initializing / ready)
 * - 控制权 (desktop vs mobile)
 * - 思考状态 (thinking)
 * - 活跃时间 (activeAt)
 */
import type { SessionState, ToolCall } from '../types/message';
/**
 * WebSocket 客户端接口
 */
export interface WebSocketClient {
    readyState: number;
    send: (data: string) => void;
}
/**
 * 会话状态管理器选项
 */
export interface SessionStateManagerOptions {
    activityFlushInterval?: number;
}
/**
 * 会话状态管理器
 */
export declare class SessionStateManager {
    private states;
    private activityAccumulator;
    private mobileClients;
    constructor(mobileClients: Set<WebSocketClient>, options?: SessionStateManagerOptions);
    /**
     * 获取或创建会话状态
     */
    getOrCreate(sessionId: string): SessionState;
    /**
     * 获取会话状态
     */
    get(sessionId: string): SessionState | undefined;
    /**
     * 获取所有会话状态
     */
    getAll(): SessionState[];
    /**
     * 获取活跃的会话（最近 5 分钟有活动）
     */
    getActive(): SessionState[];
    /**
     * 获取正在思考的会话
     */
    getThinking(): SessionState[];
    /**
     * 更新会话状态
     */
    update(sessionId: string, updates: Partial<SessionState>): void;
    /**
     * 设置 Claude 状态
     */
    setClaudeStatus(sessionId: string, status: 'not_started' | 'initializing' | 'ready'): void;
    /**
     * 设置思考状态
     */
    setThinking(sessionId: string, thinking: boolean): void;
    /**
     * 设置控制权
     */
    setControlledByUser(sessionId: string, controlledByUser: boolean): void;
    /**
     * 添加活动工具调用
     */
    addToolCall(sessionId: string, toolId: string, toolCall: ToolCall): void;
    /**
     * 移除活动工具调用
     */
    removeToolCall(sessionId: string, toolId: string): void;
    /**
     * 获取会话的活动工具调用
     */
    getToolCalls(sessionId: string): Map<string, ToolCall>;
    /**
     * 广播活动状态更新
     */
    private broadcastActivityUpdates;
    /**
     * 立即刷新所有待发送的活动更新
     */
    flushActivityUpdates(): void;
    /**
     * 移除会话状态
     */
    remove(sessionId: string): void;
    /**
     * 清空所有会话状态
     */
    clear(): void;
    /**
     * 销毁管理器
     */
    destroy(): void;
}
/**
 * 创建会话状态管理器的工厂函数
 */
export declare function createSessionStateManager(mobileClients: Set<WebSocketClient>, options?: SessionStateManagerOptions): SessionStateManager;
