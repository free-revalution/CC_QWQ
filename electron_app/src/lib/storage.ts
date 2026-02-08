/**
 * localStorage 封装工具
 * 提供类型安全的存储操作
 */

import type { Settings, Project, Conversation } from '../types'

const STORAGE_KEYS = {
  RECENT_PROJECTS: 'ccqwq_recent_projects',
  SETTINGS: 'ccqwq_settings',
  CONVERSATIONS: 'ccqwq_conversations',
  CURRENT_CONVERSATION_ID: 'ccqwq_current_conversation_id',
  LAST_PROJECT_PATH: 'ccqwq_last_project_path',
} as const

// ==================== 最近项目 ====================

/**
 * 获取最近项目列表
 */
export function getRecentProjects(): unknown[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT_PROJECTS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 保存最近项目列表
 */
export function saveRecentProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECENT_PROJECTS, JSON.stringify(projects))
  } catch (error) {
    console.error('Failed to save recent projects:', error)
  }
}

// ==================== 应用设置 ====================

/**
 * 获取应用设置
 */
export function getSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (data) {
      const parsed = JSON.parse(data)
      return {
        linkPassword: parsed.linkPassword || '',
        port: parsed.port || 3000,
      }
    }
  } catch {
    // 返回默认值
  }
  return {
    linkPassword: '',
    port: 3000,
  }
}

/**
 * 保存应用设置
 */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

// ==================== 对话历史 ====================

/**
 * 加载所有对话
 */
export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load conversations:', error)
    return []
  }
}

/**
 * 保存所有对话
 */
export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))
  } catch (error) {
    console.error('Failed to save conversations:', error)
  }
}

/**
 * 更新单个对话（增量更新）
 */
export function updateConversation(conversation: Conversation): void {
  const conversations = loadConversations()
  const index = conversations.findIndex(c => c.id === conversation.id)

  if (index >= 0) {
    conversations[index] = { ...conversation, updatedAt: Date.now() }
  } else {
    conversations.unshift(conversation)
  }

  saveConversations(conversations)
}

/**
 * 删除对话
 */
export function deleteConversation(conversationId: string): void {
  const conversations = loadConversations()
  const filtered = conversations.filter(c => c.id !== conversationId)
  saveConversations(filtered)
}

/**
 * 获取当前对话 ID
 */
export function getCurrentConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)
  } catch {
    return null
  }
}

/**
 * 设置当前对话 ID
 */
export function setCurrentConversationId(conversationId: string | null): void {
  try {
    if (conversationId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId)
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)
    }
  } catch (error) {
    console.error('Failed to save current conversation ID:', error)
  }
}

/**
 * 获取最后打开的项目路径
 */
export function getLastProjectPath(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_PROJECT_PATH)
  } catch {
    return null
  }
}

/**
 * 设置最后打开的项目路径
 */
export function setLastProjectPath(path: string | null): void {
  try {
    if (path) {
      localStorage.setItem(STORAGE_KEYS.LAST_PROJECT_PATH, path)
    } else {
      localStorage.removeItem(STORAGE_KEYS.LAST_PROJECT_PATH)
    }
  } catch (error) {
    console.error('Failed to save last project path:', error)
  }
}

// ==================== 工具函数 ====================

/**
 * 创建新对话
 */
export function createConversation(projectPath: string): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: projectPath,
    title: 'New Conversation',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * 生成对话标题（基于首条消息）
 */
export function generateConversationTitle(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= 30) {
    return trimmed
  }
  return trimmed.slice(0, 30) + '...'
}

// ==================== 清除数据 ====================

/**
 * 清除所有数据
 */
export function clearAll(): void {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.error('Failed to clear storage:', error)
  }
}
