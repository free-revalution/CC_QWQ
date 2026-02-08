import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native'
import type { Conversation, ConversationStatus } from '../types'
import { Colors } from '../theme/colors'
import { Spacing, BorderRadius, FontSize, FontWeight } from '../theme/spacing'
import { GlassCardStyles, TextStyles } from '../theme/styles'

interface ConversationListScreenProps {
  conversations: Conversation[]
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onDisconnect: () => void
}

export default function ConversationListScreen({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDisconnect,
}: ConversationListScreenProps) {
  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId)
  }

  const handleDisconnect = () => {
    Alert.alert(
      '断开连接',
      '确定要断开与桌面端的连接吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '断开', style: 'destructive', onPress: onDisconnect },
      ]
    )
  }

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return `${Math.floor(diff / 86400000)} 天前`
  }

  const getStatusColor = (status: ConversationStatus) => {
    switch (status) {
      case 'not_started':
        return Colors.text.tertiary
      case 'initializing':
        return Colors.warning
      case 'ready':
        return Colors.success
      default:
        return Colors.text.tertiary
    }
  }

  const getStatusText = (status: ConversationStatus) => {
    switch (status) {
      case 'not_started':
        return '未启动'
      case 'initializing':
        return '初始化中'
      case 'ready':
        return '就绪'
      default:
        return ''
    }
  }

  return (
    <View style={styles.container}>
      {/* 背景装饰 - 渐变光晕 */}
      <View style={styles.backgroundDecoration} />
      <View style={styles.backgroundDecoration2} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 顶部标题区域 */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconInner, { backgroundColor: Colors.gradientBlue + '20' }]}>
              <Text style={styles.icon}>💬</Text>
            </View>
          </View>

          <Text style={styles.title}>
            <Text style={styles.titleGradient}>Conversations</Text>
          </Text>

          <Text style={styles.subtitle}>选择一个对话开始聊天</Text>
        </View>

        {/* Conversation 列表 */}
        <View style={styles.listContainer}>
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>暂无对话</Text>
              <Text style={styles.emptyText}>
                桌面端还没有创建任何对话
              </Text>
            </View>
          ) : (
            conversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={[
                  styles.conversationItem,
                  selectedConversationId === conversation.id && styles.selectedItem,
                  GlassCardStyles.card,
                ]}
                onPress={() => handleSelectConversation(conversation.id)}
                activeOpacity={0.7}
              >
                {/* 左侧内容 */}
                <View style={styles.conversationContent}>
                  {/* 标题和状态 */}
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.conversationTitle,
                        selectedConversationId === conversation.id && styles.selectedTitle,
                      ]}
                      numberOfLines={1}
                    >
                      {conversation.title}
                    </Text>
                  </View>

                  {/* 最后消息预览 */}
                  {conversation.lastMessage && (
                    <Text
                      style={styles.lastMessage}
                      numberOfLines={2}
                    >
                      {conversation.lastMessage}
                    </Text>
                  )}

                  {/* 时间和状态 */}
                  <View style={styles.metaRow}>
                    <Text style={styles.timestamp}>
                      {formatTimestamp(conversation.updatedAt)}
                    </Text>
                    <View style={styles.statusContainer}>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: getStatusColor(conversation.status) },
                          conversation.status === 'initializing' && styles.statusPulse,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(conversation.status) },
                        ]}
                      >
                        {getStatusText(conversation.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 右侧箭头 */}
                {selectedConversationId !== conversation.id && (
                  <Text style={styles.arrow}>›</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* 断开连接按钮 */}
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <View style={styles.disconnectButtonInner}>
            <Text style={styles.disconnectButtonText}>断开连接</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
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
    top: -100,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gradientBlue + '10',
  },
  backgroundDecoration2: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.gradientPink + '08',
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl4,
  },
  // 头部
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl3,
    paddingBottom: Spacing.xl2,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: FontSize.xl4,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  titleGradient: {
    color: Colors.gradientBlue,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // 列表容器
  listContainer: {
    marginBottom: Spacing.lg,
  },
  // 空状态
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl4,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // Conversation 项目
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  selectedItem: {
    borderColor: Colors.gradientBlue,
    borderWidth: 2,
  },
  conversationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  conversationTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  selectedTitle: {
    color: Colors.gradientBlue,
  },
  lastMessage: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPulse: {
    // React Native 不支持 CSS 动画，这里保留为静态样式
    // 可以用 Animated API 来实现脉冲动画
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  arrow: {
    fontSize: FontSize.xl3,
    color: Colors.text.tertiary,
    marginLeft: Spacing.md,
  },
  // 断开连接按钮
  disconnectButton: {
    overflow: 'hidden',
    borderRadius: BorderRadius.xl2,
  },
  disconnectButtonInner: {
    backgroundColor: Colors.error + '20',
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderRadius: BorderRadius.xl2,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  disconnectButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },
})
