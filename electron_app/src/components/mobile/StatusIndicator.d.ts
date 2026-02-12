/**
 * Status Indicator Component
 *
 * Shows the status of a Claude conversation with a colored dot
 */
interface StatusIndicatorProps {
    status: 'not_started' | 'initializing' | 'ready';
    size?: 'sm' | 'md';
}
export default function StatusIndicator({ status, size }: StatusIndicatorProps): import("react/jsx-runtime").JSX.Element;
export {};
