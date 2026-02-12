/**
 * localStorage 封装工具
 * 提供类型安全的存储操作
 */
import type { Settings, Project, Conversation } from '../types';
/**
 * 获取最近项目列表
 */
export declare function getRecentProjects(): unknown[];
/**
 * 保存最近项目列表
 */
export declare function saveRecentProjects(projects: Project[]): void;
/**
 * 获取应用设置
 */
export declare function getSettings(): Settings;
/**
 * 保存应用设置
 */
export declare function saveSettings(settings: Settings): void;
/**
 * 加载所有对话
 */
export declare function loadConversations(): Conversation[];
/**
 * 保存所有对话
 */
export declare function saveConversations(conversations: Conversation[]): void;
/**
 * 更新单个对话（增量更新）
 */
export declare function updateConversation(conversation: Conversation): void;
/**
 * 删除对话
 */
export declare function deleteConversation(conversationId: string): void;
/**
 * 获取当前对话 ID
 */
export declare function getCurrentConversationId(): string | null;
/**
 * 设置当前对话 ID
 */
export declare function setCurrentConversationId(conversationId: string | null): void;
/**
 * 获取最后打开的项目路径
 */
export declare function getLastProjectPath(): string | null;
/**
 * 设置最后打开的项目路径
 */
export declare function setLastProjectPath(path: string | null): void;
/**
 * 创建新对话
 */
export declare function createConversation(projectPath: string): Conversation;
/**
 * 生成对话标题（基于首条消息）
 */
export declare function generateConversationTitle(message: string): string;
/**
 * 清除所有数据
 */
export declare function clearAll(): void;
