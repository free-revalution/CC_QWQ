import { vi } from 'vitest'
import { cleanup } from '@testing-library/dom'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.electronAPI with all methods
const mockElectronAPI = {
  // File operations
  openFolder: vi.fn(),
  openFile: vi.fn(),
  selectFile: vi.fn(),
  uploadFile: vi.fn(),
  readDirectory: vi.fn(),

  // Claude communication
  claudeSend: vi.fn(),
  onClaudeStream: vi.fn(),
  initializeClaude: vi.fn(),
  cleanupConversation: vi.fn(),

  // Connection
  setLinkPassword: vi.fn(),
  getConnectionInfo: vi.fn(),

  // Project
  setProjectPath: vi.fn(),

  // Chat history
  updateChatHistory: vi.fn(),
  addChatMessage: vi.fn(),
  getConversationList: vi.fn(),

  // Permissions
  requestPermission: vi.fn(),
  respondPermission: vi.fn(),
  getPermissionRules: vi.fn(),
  addPermissionRule: vi.fn(),
  clearPermissionRules: vi.fn(),
  clearRememberedChoices: vi.fn(),

  // Skills & MCP
  getSkills: vi.fn(),
  getMCPServers: vi.fn(),

  // Model
  switchModel: vi.fn(),
  readClaudeConfig: vi.fn(),

  // Git & Search
  getGitStatus: vi.fn(),
  searchFiles: vi.fn(),

  // Project conversations
  readProjectConversations: vi.fn(),
  saveProjectConversations: vi.fn(),
  deleteProjectConversation: vi.fn(),

  // Trust
  respondTrust: vi.fn(),

  // Event listeners
  onTrustRequest: vi.fn(),
  onPermissionRequest: vi.fn(),
  onClaudeStatusChange: vi.fn(),
  onActivityUpdate: vi.fn(),
  onLogEntry: vi.fn(),
  onApprovalRequest: vi.fn(),
  removeListener: vi.fn(),

  // Logs
  getLogs: vi.fn(),
  clearLogs: vi.fn(),
  exportLogs: vi.fn(),
  exportLogsV2: vi.fn(),

  // Approval engine
  sendApprovalResponse: vi.fn(),
  getApprovalPreferences: vi.fn(),
  updateApprovalPreferences: vi.fn(),

  // Checkpoints
  checkpointList: vi.fn(),
  checkpointGet: vi.fn(),
  checkpointCreate: vi.fn(),

  // Rollback
  rollbackPreview: vi.fn(),
  rollbackExecute: vi.fn(),

  // API
  getAPIUsage: vi.fn(),

  // Platform
  platform: 'darwin',
}

// Set up global window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Mock the IPC module at the actual import path
// Note: Since the codebase uses relative imports, we need to ensure
// the mock works. The IPC module internally uses window.electronAPI,
// so mocking window.electronAPI is sufficient for most cases.
// For direct imports, we also mock the module export.
vi.mock('../lib/ipc', () => ({
  ipc: {
    // File operations
    openFolder: vi.fn(),
    openFile: vi.fn(),
    selectFile: vi.fn(),
    uploadFile: vi.fn(),
    readDirectory: vi.fn(),

    // Claude communication
    claudeSend: vi.fn(),
    onClaudeStream: vi.fn(),
    initializeClaude: vi.fn(),
    cleanupConversation: vi.fn(),

    // Connection
    setLinkPassword: vi.fn(),
    getConnectionInfo: vi.fn(),

    // Project
    setProjectPath: vi.fn(),

    // Chat history
    updateChatHistory: vi.fn(),
    addChatMessage: vi.fn(),
    getConversationList: vi.fn(),

    // Permissions
    requestPermission: vi.fn(),
    respondPermission: vi.fn(),
    getPermissionRules: vi.fn(),
    addPermissionRule: vi.fn(),
    clearPermissionRules: vi.fn(),
    clearRememberedChoices: vi.fn(),

    // Skills & MCP
    getSkills: vi.fn(),
    getMCPServers: vi.fn(),

    // Model
    switchModel: vi.fn(),
    readClaudeConfig: vi.fn(),

    // Git & Search
    getGitStatus: vi.fn(),
    searchFiles: vi.fn(),

    // Project conversations
    readProjectConversations: vi.fn(),
    saveProjectConversations: vi.fn(),
    deleteProjectConversation: vi.fn(),

    // Trust
    respondTrust: vi.fn(),

    // Event listeners
    onTrustRequest: vi.fn(),
    onPermissionRequest: vi.fn(),
    onClaudeStatusChange: vi.fn(),
    onActivityUpdate: vi.fn(),
    onLogEntry: vi.fn(),
    onApprovalRequest: vi.fn(),
    removeListener: vi.fn(),

    // Logs
    getLogs: vi.fn(),
    clearLogs: vi.fn(),
    exportLogs: vi.fn(),
    exportLogsV2: vi.fn(),

    // Approval engine
    sendApprovalResponse: vi.fn(),
    getApprovalPreferences: vi.fn(),
    updateApprovalPreferences: vi.fn(),

    // Checkpoints
    checkpointList: vi.fn(),
    checkpointGet: vi.fn(),
    checkpointCreate: vi.fn(),

    // Rollback
    rollbackPreview: vi.fn(),
    rollbackExecute: vi.fn(),

    // API
    getAPIUsage: vi.fn(),

    // Platform
    platform: 'darwin',
  },
}))
