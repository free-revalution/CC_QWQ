/**
 * 审批请求数据结构
 */
export interface ApprovalRequestData {
    requestId: string;
    tool: string;
    params: Record<string, unknown>;
    riskLevel: 'low' | 'medium' | 'high';
    reason?: string;
}
interface ApprovalDialogProps {
    /** 是否打开 */
    isOpen: boolean;
    /** 审批请求数据 */
    request: ApprovalRequestData | null;
    /** 响应回调 */
    onRespond: (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => void;
    /** 关闭回调 */
    onClose: () => void;
}
export declare function ApprovalDialog({ isOpen, request, onRespond, onClose, }: ApprovalDialogProps): import("react/jsx-runtime").JSX.Element | null;
export {};
