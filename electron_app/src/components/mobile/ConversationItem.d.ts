/**
 * Conversation Item Component
 *
 * Displays a single conversation in the mobile drawer list
 */
import type { MobileConversation } from '../../types';
interface ConversationItemProps {
    conversation: MobileConversation;
    isSelected: boolean;
    onClick: () => void;
}
export default function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps): import("react/jsx-runtime").JSX.Element;
export {};
