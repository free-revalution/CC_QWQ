/**
 * 全局类型定义
 */

// ==================== 文件系统 ====================

/**
 * 文件系统节点
 */
export interface FileNode {
  name: string // 名称
  path: string // 文件或文件夹路径
  type: 'file' | 'folder' // 文件/文件夹
  children?: FileNode[] // 子节点（可选）
}

// ==================== 模型信息 ====================

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string // 模型ID
  name: string // 模型名称
  provider: string // 模型提供方
  version: string // 模型版本
  maxRequests?: number // 最大请求数（可选）
  maxTokens?: number // 最大令牌数（可选）
}

// ==================== 模型使用信息 ====================

/**
 * 模型使用信息
 */
export interface UsageInfo {
  requestsUsed: number // 已用请求数
  requestsLimit: number // 请求数限制
  tokensUsed: number // 已用令牌数
  tokensLimit: number // 令牌数限制
  resetTime: number // 重置时间戳 （Unix 时间戳）
}

// ==================== Claude 配置 ====================

/**
 * Claude 配置
 */
export interface ClaudeConfig {
  models?: ModelInfo[] // 模型列表（可选）
  currentModel?: string // 当前选中模型ID（可选）
  apiKey?: string // API 密钥（可选）
  provider?: string // 模型提供方（可选） 
}
