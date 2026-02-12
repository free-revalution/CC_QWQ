/**
 * 对话抽屉组件
 *
 * Slide-out drawer showing the list of available conversations
 */
import type { MobileConversation } from '../../types';
interface ConversationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    conversations: MobileConversation[];
    selectedConversationId: string | null;
    onSelectConversation: (id: string) => void;
}
export default function ConversationDrawer({ isOpen, onClose, conversations, selectedConversationId, onSelectConversation }: ConversationDrawerProps): import("react/jsx-runtime").JSX.Element | null;
export {};
