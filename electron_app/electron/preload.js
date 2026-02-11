const { contextBridge, ipcRenderer } = require('electron')

// 存储监听器清理函数
const listenerCleanup = new Map()

// 暴露 IPC API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openFile: () => ipcRenderer.invoke('open-file'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  claudeSend: (conversationId, projectPath, message) =>
    ipcRenderer.invoke('claude-send', conversationId, projectPath, message),
  setLinkPassword: (password) =>
    ipcRenderer.invoke('set-link-password', password),
  getConnectionInfo: () =>
    ipcRenderer.invoke('get-connection-info'),
  setProjectPath: (projectPath) =>
    ipcRenderer.invoke('set-project-path', projectPath),
  updateChatHistory: (messages) =>
    ipcRenderer.invoke('update-chat-history', messages),
  addChatMessage: (message) =>
    ipcRenderer.invoke('add-chat-message', message),
  requestPermission: (request) =>
    ipcRenderer.invoke('request-permission', request),
  getPermissionRules: () =>
    ipcRenderer.invoke('get-permission-rules'),
  addPermissionRule: (rule) =>
    ipcRenderer.invoke('add-permission-rule', rule),
  clearPermissionRules: () =>
    ipcRenderer.invoke('clear-permission-rules'),
  respondPermission: (response) =>
    ipcRenderer.invoke('respond-permission', response),
  readDirectory: (dirPath) =>
    ipcRenderer.invoke('read-directory', dirPath),
  readClaudeConfig: () =>
    ipcRenderer.invoke('read-claude-config'),
  getAPIUsage: () =>
    ipcRenderer.invoke('get-api-usage'),
  getConversationList: () =>
    ipcRenderer.invoke('get-conversation-list'),
  getSkills: () =>
    ipcRenderer.invoke('get-skills'),
  getMCPServers: () =>
    ipcRenderer.invoke('get-mcp-servers'),
  switchModel: (modelId) =>
    ipcRenderer.invoke('switch-model', modelId),
  getGitStatus: (projectPath) =>
    ipcRenderer.invoke('get-git-status', projectPath),
  searchFiles: (projectPath, query) =>
    ipcRenderer.invoke('search-files', projectPath, query),
  // 项目本地存储
  readProjectConversations: (projectPath) =>
    ipcRenderer.invoke('read-project-conversations', projectPath),
  saveProjectConversations: (projectPath, conversations) =>
    ipcRenderer.invoke('save-project-conversations', projectPath, conversations),
  deleteProjectConversation: (projectPath, conversationId) =>
    ipcRenderer.invoke('delete-project-conversation', projectPath, conversationId),
  // 响应信任文件夹请求
  respondTrust: (conversationId, trust) =>
    ipcRenderer.invoke('respond-trust', conversationId, trust),
  // 响应权限请求
  respondPermission: (conversationId, choice) =>
    ipcRenderer.invoke('respond-permission', conversationId, choice),
  // 清理对话会话
  cleanupConversation: (conversationId) =>
    ipcRenderer.invoke('cleanup-conversation', conversationId),
  // 初始化 Claude 会话
  initializeClaude: (conversationId, projectPath) =>
    ipcRenderer.invoke('initialize-claude', conversationId, projectPath),
  // 监听 Claude 流式输出
  onClaudeStream: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('claude-stream', handler)
    const cleanupId = `claude-stream-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('claude-stream', handler)
    })
    return cleanupId
  },
  // 监听信任文件夹请求
  onTrustRequest: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('claude-trust-request', handler)
    const cleanupId = `trust-request-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('claude-trust-request', handler)
    })
    return cleanupId
  },
  // 监听权限请求
  onPermissionRequest: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('claude-permission-request', handler)
    const cleanupId = `permission-request-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('claude-permission-request', handler)
    })
    return cleanupId
  },
  // 监听 Claude 初始化状态变化
  onClaudeStatusChange: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('claude-status-change', handler)
    const cleanupId = `claude-status-change-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('claude-status-change', handler)
    })
    return cleanupId
  },
  // Happy 架构改进 - 监听活动状态更新
  onActivityUpdate: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('activity-update', handler)
    const cleanupId = `activity-update-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('activity-update', handler)
    })
    return cleanupId
  },

  // ==================== 操作日志 ====================

  onLogEntry: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('log-entry', handler)
    const cleanupId = `log-entry-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('log-entry', handler)
    })
    return cleanupId
  },

  getLogs: () => ipcRenderer.invoke('get-logs'),

  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  exportLogs: (format = 'json') => ipcRenderer.invoke('export-logs', format),

  // ==================== 审批引擎 ====================

  sendApprovalResponse: (response) => {
    ipcRenderer.send('approval-response', response)
  },

  getApprovalPreferences: () => ipcRenderer.invoke('get-approval-preferences'),

  updateApprovalPreferences: (preferences) => ipcRenderer.invoke('update-approval-preferences', preferences),

  clearRememberedChoices: () => ipcRenderer.invoke('clear-remembered-choices'),

  // 订阅审批请求
  onApprovalRequest: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('approval-request', handler)
    const cleanupId = `approval-request-${Date.now()}`
    listenerCleanup.set(cleanupId, () => {
      ipcRenderer.removeListener('approval-request', handler)
    })
    return cleanupId
  },

  // ==================== 检查点管理 ====================

  // 检查点相关
  checkpointList: () => ipcRenderer.invoke('checkpoint-list'),

  checkpointGet: (id) => ipcRenderer.invoke('checkpoint-get', id),

  checkpointCreate: (name, description) => ipcRenderer.invoke('checkpoint-create', name, description),

  // ==================== 回滚管理 ====================

  // 回滚相关
  rollbackPreview: (checkpointId) => ipcRenderer.invoke('rollback-preview', checkpointId),

  rollbackExecute: (checkpointId) => ipcRenderer.invoke('rollback-execute', checkpointId),

  // ==================== 导出日志（新版本） ====================

  // 导出日志（新版本，支持 JSON/CSV/Markdown 格式）
  exportLogsV2: (options) => ipcRenderer.invoke('export-logs-v2', options),

  // 移除监听器
  removeListener: (cleanupId) => {
    const cleanup = listenerCleanup.get(cleanupId)
    if (cleanup) {
      cleanup()
      listenerCleanup.delete(cleanupId)
    }
  },
  // 平台信息
  platform: process.platform,
})
