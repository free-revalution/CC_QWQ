/**
 * ToolCallView - 工具调用展示组件
 *
 * 参考: https://github.com/slopus/happy
 *
 * 显示 Claude Code 工具调用的状态、输入和结果
 */
import type { ToolCall } from '../../types/message';
interface ToolCallViewProps {
    tool: ToolCall;
    expanded?: boolean;
}
export default function ToolCallView({ tool, expanded: defaultExpanded }: ToolCallViewProps): import("react/jsx-runtime").JSX.Element;
/**
 * 工具调用列表视图
 */
interface ToolCallListProps {
    tools: ToolCall[];
    className?: string;
}
export declare function ToolCallList({ tools, className }: ToolCallListProps): import("react/jsx-runtime").JSX.Element | null;
export {};
