import type { PermissionRequest, PermissionResponse } from '../../types';
interface PermissionModalProps {
    /** 权限请求 */
    request: PermissionRequest | null;
    /** 处理响应 */
    onResponse: (response: PermissionResponse) => void;
    /** 关闭弹窗 */
    onClose: () => void;
}
export default function PermissionModal({ request, onResponse, onClose, }: PermissionModalProps): import("react/jsx-runtime").JSX.Element | null;
export {};
