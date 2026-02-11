/**
 * Conversation Item Component
 *
 * Displays a single conversation in the mobile drawer list
 */

import { ChevronRight } from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import type { MobileConversation } from '../../types'

interface ConversationItemProps {
  conversation: MobileConversation
  isSelected: boolean
  onClick: () => void
}

export default function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg transition-all duration-200
        ${isSelected
          ? 'bg-blue-500/20 border border-blue-500/30'
          : 'bg-white/5 hover:bg-white/10 border border-transparent'
        }
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIndicator status={conversation.status} size="sm" />
            <span className="text-sm font-medium text-primary truncate">
              {conversation.title}
            </span>
          </div>
          {conversation.lastMessage && (
            <p className="text-xs text-secondary truncate">
              {conversation.lastMessage}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-secondary flex-shrink-0" />
      </div>
    </button>
  )
}
