/**
 * ActivityAccumulator - 活动状态累积器
 *
 * 参考: https://github.com/slopus/happy
 *
 * 将短时间内的多次状态更新合并为一次批量发送，
 * 减少 WebSocket 消息数量，提高性能。
 */
import type { ActivityUpdate } from '../types/message';
/**
 * 活动状态累积器配置
 */
export interface ActivityAccumulatorOptions {
    flushInterval?: number;
    maxBufferSize?: number;
}
/**
 * 活动状态累积器
 */
export declare class ActivityAccumulator {
    private updates;
    private timer;
    private flushInterval;
    private maxBufferSize;
    private flushCallback;
    constructor(flushCallback: (updates: ActivityUpdate[]) => void, options?: ActivityAccumulatorOptions);
    /**
     * 添加更新（带防抖）
     */
    addUpdate(sessionId: string, update: Partial<ActivityUpdate>): void;
    /**
     * 刷新所有待发送的更新
     */
    private flush;
    /**
     * 立即刷新（不等待防抖）
     */
    flushNow(): void;
    /**
     * 获取当前缓冲的更新数量
     */
    get size(): number;
    /**
     * 清空缓冲区
     */
    clear(): void;
    /**
     * 销毁累积器
     */
    destroy(): void;
}
/**
 * 创建活动状态累积器的工厂函数
 */
export declare function createActivityAccumulator(flushCallback: (updates: ActivityUpdate[]) => void, options?: ActivityAccumulatorOptions): ActivityAccumulator;
