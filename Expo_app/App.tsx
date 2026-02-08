import { useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import LoginScreen from './src/screens/LoginScreen'
import ConversationListScreen from './src/screens/ConversationListScreen'
import ChatScreen from './src/screens/ChatScreen'
import { useWebSocket } from './src/hooks/useWebSocket'
import type { ConnectionConfig } from './src/types'

type Screen = 'login' | 'conversations' | 'chat'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login')
  const [wsConfig, setWsConfig] = useState<ConnectionConfig | null>(null)

  const {
    messages,
    conversations,
    selectedConversationId,
    status: connectionStatus,
    claudeStatus,
    connect,
    disconnect,
    sendMessage,
    selectConversation,
  } = useWebSocket()

  const handleConnect = (config: ConnectionConfig) => {
    setWsConfig(config)
    connect(config)
    setCurrentScreen('conversations')
  }

  const handleDisconnect = () => {
    disconnect()
    setWsConfig(null)
    setCurrentScreen('login')
  }

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId)
    setCurrentScreen('chat')
  }

  const handleBackToList = () => {
    setCurrentScreen('conversations')
  }

  const handleSendMessage = (content: string) => {
    sendMessage(content)
  }

  return (
    <SafeAreaProvider>
      {currentScreen === 'login' ? (
        <LoginScreen onConnect={handleConnect} />
      ) : currentScreen === 'conversations' ? (
        <ConversationListScreen
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <ChatScreen
          messages={messages}
          claudeStatus={claudeStatus}
          connectionStatus={connectionStatus}
          onSendMessage={handleSendMessage}
          onDisconnect={handleDisconnect}
          onBackToList={handleBackToList}
        />
      )}
    </SafeAreaProvider>
  )
}
