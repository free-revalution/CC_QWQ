/**
 * 全局类型定义
 */

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  version: string
  maxRequests?: number
  maxTokens?: number
}

export interface UsageInfo {
  requestsUsed: number
  requestsLimit: number
  tokensUsed: number
  tokensLimit: number
  resetTime: number
}

export interface ClaudeConfig {
  models?: ModelInfo[]
  currentModel?: string
  apiKey?: string
  provider?: string
}
