/**
 * ActivityIndicator - 活动状态指示器组件
 *
 * 参考: https://github.com/slopus/happy
 *
 * 显示会话的实时活动状态（thinking、active）
 */
interface ActivityIndicatorProps {
    active?: boolean;
    thinking?: boolean;
    activeAt?: number;
    thinkingAt?: number;
    className?: string;
}
export default function ActivityIndicator({ active, thinking, activeAt, thinkingAt, className }: ActivityIndicatorProps): import("react/jsx-runtime").JSX.Element | null;
/**
 * 紧凑的活动状态指示点（用于会话列表）
 */
interface ActivityDotProps {
    active?: boolean;
    thinking?: boolean;
    className?: string;
}
export declare function ActivityDot({ active, thinking, className }: ActivityDotProps): import("react/jsx-runtime").JSX.Element | null;
export {};
