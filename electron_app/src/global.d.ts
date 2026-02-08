// 全局类型定义

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

interface ModelInfo {
  id: string
  name: string
  provider: string
  version: string
}

interface ClaudeConfig {
  models?: ModelInfo[]
  currentModel?: string
  apiKey?: string
  provider?: string
}

interface UsageInfo {
  requestsUsed: number
  requestsLimit: number
  tokensUsed: number
  tokensLimit: number
  resetTime: number
}

interface ElectronAPI {
  openFolder: () => Promise<string | null>
  openFile: () => Promise<string | null>
  selectFile: () => Promise<{ success: boolean; filePath?: string }>
  claudeSend: (projectPath: string, message: string) => Promise<{ messageId: string }>
  setLinkPassword: (password: string) => Promise<{ success: boolean; port: number }>
  getConnectionInfo: () => Promise<{ ip: string; port: number; hasPassword: boolean }>
  setProjectPath: (projectPath: string) => Promise<{ success: boolean }>
  updateChatHistory: (messages: unknown[]) => Promise<{ success: boolean }>
  addChatMessage: (message: unknown) => Promise<{ success: boolean }>
  requestPermission: (request: unknown) => Promise<unknown>
  getPermissionRules: () => Promise<unknown[]>
  addPermissionRule: (rule: unknown) => Promise<{ success: boolean }>
  clearPermissionRules: () => Promise<{ success: boolean }>
  respondPermission: (response: { requestId: string; choice: string; claudeRequestId?: string }) => Promise<{ success: boolean; error?: string }>
  readDirectory: (dirPath: string) => Promise<{ success: boolean; tree?: FileNode[]; error?: string }>
  readClaudeConfig: () => Promise<{ success: boolean; config?: ClaudeConfig; error?: string }>
  getAPIUsage: () => Promise<{ success: boolean; usage?: UsageInfo; error?: string }>
  getSkills: () => Promise<{ success: boolean; skills?: Array<{ name: string; path: string; description?: string }>; error?: string }>
  getMCPServers: () => Promise<{ success: boolean; servers?: Array<{ name: string; command: string; args?: string[] }>; error?: string }>
  switchModel: (modelId: string) => Promise<{ success: boolean; modelId?: string; error?: string }>
  getGitStatus: (projectPath: string) => Promise<{ success: boolean; git?: { currentBranch: string; branches: string[]; status: string; commits: Array<{ hash: string; message: string; author: string; date: string }> }; error?: string }>
  searchFiles: (projectPath: string, query: string) => Promise<{ success: boolean; results?: Array<{ file: string; line: number; content: string }>; error?: string }>
  /** 平台信息：'darwin' | 'win32' | 'linux' */
  platform: string
  /**
   * 监听权限请求事件
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onPermissionRequest: (callback: (data: { projectPath: string; toolName: string; details: string }) => void) => string
  /**
   * 监听 Claude 流式输出
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onClaudeStream: (callback: (data: { conversationId: string; messageId: string; type: string; content: string; toolName?: string; toolInput?: string; timestamp: number }) => void) => string
  /**
   * 监听信任文件夹请求
   * @param callback 回调函数
   * @returns 清理 ID
   */
  onTrustRequest: (callback: (data: { projectPath: string; message: string }) => void) => string
  /**
   * 移除监听器
   * @param cleanupId 清理 ID
   */
  removeListener: (cleanupId: string) => void
  /**
   * 读取项目的对话记录
   * @param projectPath 项目路径
   */
  readProjectConversations: (projectPath: string) => Promise<{ success: boolean; conversations?: Conversation[]; error?: string }>
  /**
   * 保存项目的对话记录
   * @param projectPath 项目路径
   * @param conversations 对话记录数组
   */
  saveProjectConversations: (projectPath: string, conversations: Conversation[]) => Promise<{ success: boolean; error?: string }>
  /**
   * 删除项目的对话记录
   * @param projectPath 项目路径
   * @param conversationId 对话 ID
   */
  deleteProjectConversation: (projectPath: string, conversationId: string) => Promise<{ success: boolean; error?: string }>
  /**
   * 响应信任文件夹请求
   * @param projectPath 项目路径
   * @param trust 是否信任
   */
  respondTrust: (projectPath: string, trust: boolean) => Promise<{ success: boolean; error?: string }>
  /**
   * 响应权限请求
   * @param projectPath 项目路径
   * @param choice 选择 (yes, no, yesAlways, noAlways, exit)
   */
  respondPermission: (projectPath: string, choice: string) => Promise<{ success: boolean; error?: string }>
  /**
   * 获取 conversation 列表（用于移动端同步）
   */
  getConversationList: () => Promise<{ success: boolean; conversations?: Array<{
    id: string
    title: string
    status: 'not_started' | 'initializing' | 'ready'
    lastMessage?: string
    updatedAt: number
  }>; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
