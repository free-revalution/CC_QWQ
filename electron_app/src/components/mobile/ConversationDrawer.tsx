/**
 * 对话抽屉组件
 *
 * Slide-out drawer showing the list of available conversations
 */

import { X } from 'lucide-react'
import ConversationItem from './ConversationItem'
import type { MobileConversation } from '../../types'

interface ConversationDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversations: MobileConversation[]
  selectedConversationId: string | null
  onSelectConversation: (id: string) => void
}

export default function ConversationDrawer({
  isOpen,
  onClose,
  conversations,
  selectedConversationId,
  onSelectConversation
}: ConversationDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div className="relative w-80 max-w-[80vw] h-full bg-gray-900/95 backdrop-blur-xl border-r border-white/10">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-primary">对话列表</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-secondary" />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              暂无对话
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversationId === conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
