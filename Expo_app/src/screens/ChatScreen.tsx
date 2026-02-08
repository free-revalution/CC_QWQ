import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ChatMessage, ConnectionStatus, ClaudeStatus } from '../types'
import { Colors } from '../theme/colors'
import { Spacing, BorderRadius, FontSize, FontWeight } from '../theme/spacing'
import { GlassCardStyles, StatusStyles } from '../theme/styles'

interface ChatScreenProps {
  messages: ChatMessage[]
  claudeStatus: ClaudeStatus
  connectionStatus: ConnectionStatus
  onSendMessage: (content: string) => void
  onDisconnect: () => void
  onBackToList: () => void
}

export default function ChatScreen({
  messages,
  claudeStatus,
  connectionStatus,
  onSendMessage,
  onDisconnect,
  onBackToList,
}: ChatScreenProps) {
  const [inputValue, setInputValue] = useState('')
  const insets = useSafeAreaInsets()

  const handleSend = () => {
    if (!inputValue.trim() || claudeStatus === 'thinking') return

    onSendMessage(inputValue)
    setInputValue('')
  }

  // 处理软键盘的提交按钮（仅在输入法完成时触发）
  const handleSubmitEditing = () => {
    handleSend()
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return '正在连接...'
      case 'authenticating':
        return '正在验证...'
      case 'error':
        return '连接错误'
      case 'disconnected':
        return '已断开连接'
      default:
        return null
    }
  }

  const statusText = getStatusText()

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* 背景装饰 */}
      <View style={styles.backgroundDecoration} />
      <View style={styles.backgroundDecoration2} />

      {/* 顶部栏 - 带安全区域适配 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* 左侧状态指示器 */}
        <View style={styles.headerLeft}>
          <View style={[
            StatusStyles.indicator,
            connectionStatus === 'connected' ? StatusStyles.indicatorActive : StatusStyles.indicatorInactive,
          ]} />
          <Text style={styles.headerTitle}>CC QwQ</Text>
        </View>

        {/* 中间 - 返回列表按钮 */}
        <TouchableOpacity
          style={[styles.backButton, GlassCardStyles.cardSmall]}
          onPress={onBackToList}
        >
          <Text style={styles.backButtonText}>‹ 列表</Text>
        </TouchableOpacity>

        {/* 断开按钮 */}
        <TouchableOpacity
          style={[styles.disconnectButton, GlassCardStyles.cardSmall]}
          onPress={onDisconnect}
        >
          <Text style={styles.disconnectButtonText}>断开</Text>
        </TouchableOpacity>
      </View>

      {/* 连接状态横幅 */}
      {statusText && connectionStatus !== 'connected' && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      )}

      {/* 消息列表 */}
      <ScrollView
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            {/* 空状态图标 */}
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>✨</Text>
            </View>
            <Text style={styles.emptyText}>开始对话</Text>
            <Text style={styles.emptySubtext}>向 Claude Code 发送消息</Text>
          </View>
        ) : (
          messages.map((message, index) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant,
                ]}
              >
                {/* 发送者头像 */}
                <View style={[
                  styles.avatar,
                  message.role === 'user' ? styles.avatarUser : styles.avatarAssistant,
                ]}>
                  <Text style={styles.avatarText}>
                    {message.role === 'user' ? 'U' : 'C'}
                  </Text>
                </View>

                {/* 消息内容 */}
                <View style={styles.messageContentWrapper}>
                  <Text style={styles.messageRole}>
                    {message.role === 'user' ? '你' : 'Claude'}
                  </Text>
                  <Text style={styles.messageContent}>{message.content}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Claude 思考状态 */}
        {claudeStatus === 'thinking' && (
          <View style={styles.messageRow}>
            <View style={styles.messageBubbleAssistant}>
              <View style={styles.avatarAssistant}>
                <Text style={styles.avatarText}>C</Text>
              </View>
              <View style={styles.messageContentWrapper}>
                <Text style={styles.messageRole}>Claude</Text>
                <View style={styles.thinkingContainer}>
                  <Text style={styles.thinkingText}>Claude 正在思考</Text>
                  <View style={styles.dots}>
                    <View style={[styles.dot, styles.dot1]} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 底部输入框 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom}
      >
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          {/* 输入框和按钮行 */}
          <View style={styles.inputRow}>
            {/* 输入框 */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={handleSubmitEditing}
                placeholder={claudeStatus === 'thinking' ? 'Claude 正在思考...' : '输入消息...'}
                placeholderTextColor={Colors.text.tertiary}
                multiline
                maxLength={1000}
                editable={claudeStatus !== 'thinking'}
                textAlignVertical="top"
                returnKeyType="send"
              />
            </View>

            {/* 按钮组 */}
            <View style={styles.buttonGroup}>
              {/* 发送按钮 */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputValue.trim() || claudeStatus === 'thinking') && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputValue.trim() || claudeStatus === 'thinking'}
              >
                <Text style={styles.sendButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // 背景装饰
  backgroundDecoration: {
    position: 'absolute',
    top: 100,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.gradientBlue + '08',
  },
  backgroundDecoration2: {
    position: 'absolute',
    bottom: 120,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.gradientPurple + '06',
  },
  // 顶部栏
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface + '95',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  disconnectButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  disconnectButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  backButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.gradientBlue,
  },
  // 状态横幅
  statusBanner: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '30',
  },
  statusText: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
  },
  // 消息容器
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl3,
  },
  // 空状态
  emptyState: {
    alignItems: 'center',
    marginTop: Spacing.xl5,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gradientBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIconText: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: FontSize.xl2,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
  },
  // 消息行
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  // 消息气泡
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  messageBubbleUser: {
    backgroundColor: Colors.gradientBlue + '15',
    borderColor: Colors.gradientBlue + '20',
    borderBottomRightRadius: BorderRadius.sm,
  },
  messageBubbleAssistant: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderLight,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  // 头像
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    backgroundColor: Colors.gradientBlue,
  },
  avatarAssistant: {
    backgroundColor: Colors.surfaceSolid,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.inverse,
  },
  // 消息内容
  messageContentWrapper: {
    flex: 1,
  },
  messageRole: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  messageContent: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  // 思考动画
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thinkingText: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.tertiary,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  // 输入区域
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface + '95',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.surfaceSolid,
    borderRadius: BorderRadius.xl3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    maxHeight: 100,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    minHeight: 40,
    maxHeight: 90,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl2,
    backgroundColor: Colors.gradientBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: FontSize.xl,
    color: Colors.text.inverse,
    fontWeight: FontWeight.medium,
  },
})
