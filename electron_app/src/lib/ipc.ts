import type { ElectronAPI, Message, PermissionRequest, PermissionRule, Conversation } from '../types'

/**
 * Electron IPC 通信封装
 */
export const ipc: ElectronAPI = {
  /**
   * 打开文件夹选择器
   * @returns 选中的文件夹路径，取消时返回 null
   */
  openFolder: async () => {
    if (window.electronAPI?.openFolder) {
      return window.electronAPI.openFolder()
    }
    console.warn('electronAPI not available, running in mock mode')
    return null
  },

  /**
   * 打开文件选择器
   * @returns 选中的文件路径，取消时返回 null
   */
  openFile: async () => {
    if (window.electronAPI?.openFile) {
      return window.electronAPI.openFile()
    }
    console.warn('electronAPI not available, running in mock mode')
    return null
  },

  /**
   * 选择文件（用于文件附件功能）
   * @returns 选择结果，包含 success 和 filePath
   */
  selectFile: async () => {
    if (window.electronAPI?.selectFile) {
      return window.electronAPI.selectFile()
    }
    console.warn('electronAPI not available, running in mock mode')
    return { success: false }
  },

  /**
   * 上传文件到对话
   * @param filePath 文件路径
   * @param conversationId 对话 ID
   * @returns 上传结果
   */
  uploadFile: async (filePath: string, conversationId: string) => {
    if (window.electronAPI?.uploadFile) {
      return window.electronAPI.uploadFile(filePath, conversationId)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 发送消息给 Claude Code
   * @param conversationId 对话 ID
   * @param projectPath 项目路径
   * @param message 用户消息
   * @param filterMode 过滤模式
   * @returns 消息 ID
   */
  claudeSend: async (conversationId: string, projectPath: string, message: string, filterMode?: 'talk' | 'develop') => {
    if (window.electronAPI?.claudeSend) {
      return window.electronAPI.claudeSend(conversationId, projectPath, message, filterMode)
    }
    console.warn('electronAPI not available, running in mock mode')
    return { messageId: `mock-${Date.now()}` }
  },

  /**
   * 监听 Claude 流式输出
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onClaudeStream: (callback: (data: { conversationId: string; messageId: string; type: string; content: string; toolName?: string; toolInput?: string; timestamp: number }) => void) => {
    if (window.electronAPI?.onClaudeStream) {
      const cleanupId = window.electronAPI.onClaudeStream(callback)
      return cleanupId
    }
    console.warn('electronAPI.onClaudeStream not available, running in mock mode')
    // 在模拟模式下，我们不设置实际的监听器，因为没有后端
    return ''
  },

  /**
   * 设置连接密码
   * @param password 连接密码
   */
  setLinkPassword: async (password: string) => {
    if (window.electronAPI?.setLinkPassword) {
      return window.electronAPI.setLinkPassword(password)
    }
    console.warn('electronAPI not available')
    return { success: false, port: 3000 }
  },

  /**
   * 获取连接信息
   */
  getConnectionInfo: async () => {
    if (window.electronAPI?.getConnectionInfo) {
      return window.electronAPI.getConnectionInfo()
    }
    console.warn('electronAPI not available')
    return { ip: '192.168.1.100', port: 3000, hasPassword: false }
  },

  /**
   * 设置当前项目路径
   * @param projectPath 项目路径
   */
  setProjectPath: async (projectPath: string) => {
    if (window.electronAPI?.setProjectPath) {
      return window.electronAPI.setProjectPath(projectPath)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 更新聊天历史
   * @param messages 消息列表
   */
  updateChatHistory: async (messages: Message[]) => {
    if (window.electronAPI?.updateChatHistory) {
      return window.electronAPI.updateChatHistory(messages)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 添加单条消息
   * @param message 消息对象
   */
  addChatMessage: async (message: Message) => {
    if (window.electronAPI?.addChatMessage) {
      return window.electronAPI.addChatMessage(message)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 请求权限
   * @param request 权限请求对象
   */
  requestPermission: async (request: PermissionRequest) => {
    if (window.electronAPI?.requestPermission) {
      return window.electronAPI.requestPermission(request)
    }
    console.warn('electronAPI not available')
    return {
      requestId: request.id,
      choice: 'no',
      timestamp: Date.now(),
      source: 'desktop',
    }
  },

  /**
   * 获取权限规则列表
   */
  getPermissionRules: async () => {
    if (window.electronAPI?.getPermissionRules) {
      return window.electronAPI.getPermissionRules()
    }
    console.warn('electronAPI not available')
    return []
  },

  /**
   * 添加权限规则
   * @param rule 权限规则对象
   */
  addPermissionRule: async (rule: PermissionRule) => {
    if (window.electronAPI?.addPermissionRule) {
      return window.electronAPI.addPermissionRule(rule)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 清除权限规则
   */
  clearPermissionRules: async () => {
    if (window.electronAPI?.clearPermissionRules) {
      return window.electronAPI.clearPermissionRules()
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 获取已安装的 Skills
   */
  getSkills: async () => {
    if (window.electronAPI?.getSkills) {
      return window.electronAPI.getSkills()
    }
    console.warn('electronAPI not available')
    return { success: false, skills: [] }
  },

  /**
   * 获取 MCP 服务器配置
   */
  getMCPServers: async () => {
    if (window.electronAPI?.getMCPServers) {
      return window.electronAPI.getMCPServers()
    }
    console.warn('electronAPI not available')
    return { success: false, servers: [] }
  },

  /**
   * 切换模型
   * @param modelId 模型 ID
   */
  switchModel: async (modelId: string) => {
    if (window.electronAPI?.switchModel) {
      return window.electronAPI.switchModel(modelId)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 获取 Git 状态
   * @param projectPath 项目路径
   */
  getGitStatus: async (projectPath: string) => {
    if (window.electronAPI?.getGitStatus) {
      return window.electronAPI.getGitStatus(projectPath)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 搜索文件内容
   * @param projectPath 项目路径
   * @param query 搜索查询
   */
  searchFiles: async (projectPath: string, query: string) => {
    if (window.electronAPI?.searchFiles) {
      return window.electronAPI.searchFiles(projectPath, query)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 读取项目的对话记录
   * @param projectPath 项目路径
   */
  readProjectConversations: async (projectPath: string) => {
    if (window.electronAPI?.readProjectConversations) {
      return window.electronAPI.readProjectConversations(projectPath)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 保存项目的对话记录
   * @param projectPath 项目路径
   * @param conversations 对话记录数组
   */
  saveProjectConversations: async (projectPath: string, conversations: Conversation[]) => {
    if (window.electronAPI?.saveProjectConversations) {
      return window.electronAPI.saveProjectConversations(projectPath, conversations)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 删除项目的对话记录
   * @param projectPath 项目路径
   * @param conversationId 对话 ID
   */
  deleteProjectConversation: async (projectPath: string, conversationId: string) => {
    if (window.electronAPI?.deleteProjectConversation) {
      return window.electronAPI.deleteProjectConversation(projectPath, conversationId)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 响应信任文件夹请求
   * @param conversationId 对话 ID
   * @param trust 是否信任
   */
  respondTrust: async (conversationId: string, trust: boolean) => {
    if (window.electronAPI?.respondTrust) {
      return window.electronAPI.respondTrust(conversationId, trust)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 响应权限请求
   * @param conversationId 对话 ID
   * @param choice 选择 (yes, no, yesAlways, noAlways, exit)
   */
  respondPermission: async (conversationId: string, choice: string) => {
    if (window.electronAPI?.respondPermission) {
      return window.electronAPI.respondPermission(conversationId, choice)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 清理对话会话
   * @param conversationId 对话 ID
   */
  cleanupConversation: async (conversationId: string) => {
    if (window.electronAPI?.cleanupConversation) {
      return window.electronAPI.cleanupConversation(conversationId)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 初始化 Claude 会话
   * @param conversationId 对话 ID
   * @param projectPath 项目路径
   */
  initializeClaude: async (conversationId: string, projectPath: string) => {
    if (window.electronAPI?.initializeClaude) {
      return window.electronAPI.initializeClaude(conversationId, projectPath)
    }
    console.warn('electronAPI not available')
    return { success: false }
  },

  /**
   * 监听信任文件夹请求
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onTrustRequest: (callback: (data: { conversationId: string; projectPath: string; message: string }) => void) => {
    if (window.electronAPI?.onTrustRequest) {
      return window.electronAPI.onTrustRequest(callback)
    }
    console.warn('electronAPI.onTrustRequest not available')
    return ''
  },

  /**
   * 监听权限请求
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onPermissionRequest: (callback: (data: { conversationId: string; projectPath: string; toolName: string; details: string }) => void) => {
    if (window.electronAPI?.onPermissionRequest) {
      return window.electronAPI.onPermissionRequest(callback)
    }
    console.warn('electronAPI.onPermissionRequest not available')
    return ''
  },

  /**
   * 监听 Claude 初始化状态变化
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onClaudeStatusChange: (callback: (data: { conversationId: string; status: 'not_started' | 'initializing' | 'ready' }) => void) => {
    if (window.electronAPI?.onClaudeStatusChange) {
      return window.electronAPI.onClaudeStatusChange(callback)
    }
    console.warn('electronAPI.onClaudeStatusChange not available')
    return ''
  },

  /**
   * Happy 架构改进 - 监听活动状态更新
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onActivityUpdate: (callback: (data: import('../types/message').ActivityUpdate) => void) => {
    if (window.electronAPI?.onActivityUpdate) {
      return window.electronAPI.onActivityUpdate(callback)
    }
    console.warn('electronAPI.onActivityUpdate not available')
    return ''
  },

  /**
   * 读取目录
   * @param dirPath 目录路径
   */
  readDirectory: async (dirPath: string) => {
    if (window.electronAPI?.readDirectory) {
      return window.electronAPI.readDirectory(dirPath)
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 读取 Claude 配置
   */
  readClaudeConfig: async () => {
    if (window.electronAPI?.readClaudeConfig) {
      return window.electronAPI.readClaudeConfig()
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 获取 API 用量
   */
  getAPIUsage: async () => {
    if (window.electronAPI?.getAPIUsage) {
      return window.electronAPI.getAPIUsage()
    }
    console.warn('electronAPI not available')
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 获取 conversation 列表（用于移动端同步）
   */
  getConversationList: async () => {
    if (window.electronAPI?.getConversationList) {
      return window.electronAPI.getConversationList()
    }
    console.warn('electronAPI.getConversationList not available')
    return { success: false, conversations: [] }
  },

  // ==================== 操作日志 ====================

  /**
   * 订阅实时日志
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onLogEntry: (callback: (data: import('../types/operation').LogEntry) => void) => {
    if (window.electronAPI?.onLogEntry) {
      const cleanupId = window.electronAPI.onLogEntry(callback)
      return cleanupId
    }
    console.warn('electronAPI.onLogEntry not available')
    return ''
  },

  /**
   * 获取日志
   */
  getLogs: async (filter?: import('../types/operation').LogFilter) => {
    if (window.electronAPI?.getLogs) {
      return window.electronAPI.getLogs(filter)
    }
    console.warn('electronAPI.getLogs not available')
    return []
  },

  /**
   * 清空日志
   */
  clearLogs: async () => {
    if (window.electronAPI?.clearLogs) {
      return window.electronAPI.clearLogs()
    }
    console.warn('electronAPI.clearLogs not available')
    return { success: false }
  },

  /**
   * 导出日志
   */
  exportLogs: async (format: 'json' | 'text' = 'json') => {
    if (window.electronAPI?.exportLogs) {
      return window.electronAPI.exportLogs(format)
    }
    console.warn('electronAPI.exportLogs not available')
    return ''
  },

  // ==================== 审批引擎 ====================

  /**
   * 发送审批响应
   */
  sendApprovalResponse: (response: {
    requestId: string
    choice: 'approve' | 'deny'
    remember: 'once' | 'always'
  }) => {
    if (window.electronAPI?.sendApprovalResponse) {
      window.electronAPI.sendApprovalResponse(response)
    } else {
      console.warn('electronAPI.sendApprovalResponse not available')
    }
  },

  /**
   * 获取审批偏好设置
   */
  getApprovalPreferences: async () => {
    if (window.electronAPI?.getApprovalPreferences) {
      return window.electronAPI.getApprovalPreferences()
    }
    console.warn('electronAPI.getApprovalPreferences not available')
    return {
      autoApproveLowRisk: true,
      requireConfirmation: true,
      rememberChoices: true,
      notificationLevel: 'risky'
    }
  },

  /**
   * 更新审批偏好设置
   */
  updateApprovalPreferences: async (preferences: Partial<{
    autoApproveLowRisk: boolean
    requireConfirmation: boolean
    rememberChoices: boolean
    notificationLevel: 'all' | 'risky' | 'errors'
  }>) => {
    if (window.electronAPI?.updateApprovalPreferences) {
      return window.electronAPI.updateApprovalPreferences(preferences)
    }
    console.warn('electronAPI.updateApprovalPreferences not available')
    return { success: false }
  },

  /**
   * 清除记住的选择
   */
  clearRememberedChoices: async () => {
    if (window.electronAPI?.clearRememberedChoices) {
      return window.electronAPI.clearRememberedChoices()
    }
    console.warn('electronAPI.clearRememberedChoices not available')
    return { success: false }
  },

  /**
   * 订阅审批请求
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onApprovalRequest: (callback: (data: {
    requestId: string
    tool: string
    params: Record<string, unknown>
    riskLevel: 'low' | 'medium' | 'high'
    reason?: string
  }) => void) => {
    if (window.electronAPI?.onApprovalRequest) {
      const cleanupId = window.electronAPI.onApprovalRequest(callback)
      return cleanupId
    }
    console.warn('electronAPI.onApprovalRequest not available')
    return ''
  },

  /**
   * 移除监听器
   * @param cleanupId 清理 ID
   */
  removeListener: (cleanupId: string) => {
    if (window.electronAPI?.removeListener) {
      window.electronAPI.removeListener(cleanupId)
    }
  },

  // ==================== 检查点管理 ====================

  /**
   * 列出所有检查点
   */
  checkpointList: async () => {
    if (window.electronAPI?.checkpointList) {
      return window.electronAPI.checkpointList()
    }
    console.warn('electronAPI.checkpointList not available')
    return []
  },

  /**
   * 获取单个检查点
   */
  checkpointGet: async (id: string) => {
    if (window.electronAPI?.checkpointGet) {
      return window.electronAPI.checkpointGet(id)
    }
    console.warn('electronAPI.checkpointGet not available')
    return null
  },

  /**
   * 手动创建检查点
   */
  checkpointCreate: async (name: string, description: string) => {
    if (window.electronAPI?.checkpointCreate) {
      return window.electronAPI.checkpointCreate(name, description)
    }
    console.warn('electronAPI.checkpointCreate not available')
    return null
  },

  // ==================== 回滚引擎 ====================

  /**
   * 预览回滚
   */
  rollbackPreview: async (checkpointId: string) => {
    if (window.electronAPI?.rollbackPreview) {
      return window.electronAPI.rollbackPreview(checkpointId)
    }
    console.warn('electronAPI.rollbackPreview not available')
    return { files: [], canRollback: false, warnings: ['API not available'] }
  },

  /**
   * 执行回滚
   */
  rollbackExecute: async (checkpointId: string) => {
    if (window.electronAPI?.rollbackExecute) {
      return window.electronAPI.rollbackExecute(checkpointId)
    }
    console.warn('electronAPI.rollbackExecute not available')
    return { success: false, error: 'API not available' }
  },

  // ==================== 日志导出 ====================

  /**
   * 导出日志（支持 CSV 和 Markdown）
   */
  exportLogsV2: async (options: { format: 'json' | 'csv' | 'markdown', timeRange?: { start: number; end: number } }) => {
    if (window.electronAPI?.exportLogsV2) {
      return window.electronAPI.exportLogsV2(options)
    }
    console.warn('electronAPI.exportLogsV2 not available')
    return { success: false, error: 'API not available', content: '' }
  },

  /**
   * 平台信息
   */
  platform: typeof window !== 'undefined' ? (window.electronAPI?.platform || 'unknown') : 'unknown',
}
