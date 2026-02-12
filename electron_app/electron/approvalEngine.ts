/**
 * Approval Engine - 审批引擎
 *
 * 控制工具调用的权限，执行规则匹配和用户确认
 */

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import * as os from 'os'
import type {
  ToolPermissionConfig,
  ApprovalDecision,
  ToolCallRequest,
  UserPreferences
} from '../src/types/operation'

// Use os.homedir() as fallback for systems where process.env.HOME is undefined
const homeDir = process.env.HOME || os.homedir()

// 简单的 glob 匹配实现（避免依赖）
function matchesPattern(value: string, pattern: string): boolean {
  // 简化的 glob 匹配
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(regex).test(value)
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.startsWith('!')) {
      // 否定模式
      const regex = pattern.substring(1).replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      return !new RegExp(regex).test(value)
    }
    return matchesPattern(value, pattern)
  })
}

/**
 * 默认工具权限配置
 */
const DEFAULT_TOOL_PERMISSIONS: Map<string, ToolPermissionConfig> = new Map([
  // Browser tools
  ['browser_navigate', {
    tool: 'browser_navigate',
    requiresApproval: false,
    riskLevel: 'low',
    sandboxConstraints: {
      allowedUrls: ['https://*', 'http://localhost:*']
    }
  }],
  ['browser_click', {
    tool: 'browser_click',
    requiresApproval: true,
    riskLevel: 'medium'
  }],
  ['browser_fill', {
    tool: 'browser_fill',
    requiresApproval: true,
    riskLevel: 'medium'
  }],
  ['browser_screenshot', {
    tool: 'browser_screenshot',
    requiresApproval: false,
    riskLevel: 'low'
  }],
  ['browser_text', {
    tool: 'browser_text',
    requiresApproval: false,
    riskLevel: 'low'
  }],
  ['browser_wait', {
    tool: 'browser_wait',
    requiresApproval: false,
    riskLevel: 'low'
  }],
  ['browser_evaluate', {
    tool: 'browser_evaluate',
    requiresApproval: true,
    riskLevel: 'high'
  }],
  ['browser_cookies', {
    tool: 'browser_cookies',
    requiresApproval: true,
    riskLevel: 'high'
  }],
  ['browser_upload', {
    tool: 'browser_upload',
    requiresApproval: true,
    riskLevel: 'high',
    sandboxConstraints: {
      allowedPaths: [homeDir + '/development/**', homeDir + '/Downloads/**']
    }
  }],
  ['browser_download', {
    tool: 'browser_download',
    requiresApproval: true,
    riskLevel: 'medium',
    sandboxConstraints: {
      allowedPaths: [homeDir + '/.claude-browser/**']
    }
  }],

  // 文件工具
  ['sandbox_read_file', {
    tool: 'sandbox_read_file',
    requiresApproval: false,
    riskLevel: 'low',
    sandboxConstraints: {
      allowedPaths: [
        homeDir + '/development/**',
        '!**/.env',
        '!**/secrets/**',
        '!**/*.key',
        '!**/*.pem'
      ]
    }
  }],
  ['sandbox_write_file', {
    tool: 'sandbox_write_file',
    requiresApproval: true,
    riskLevel: 'high',
    sandboxConstraints: {
      allowedPaths: [
        homeDir + '/development/**',
        '!**/*.exe',
        '!**/*.sh',
        '!**/package-lock.json',
        '!**/.env'
      ],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    }
  }],

  // 系统工具
  ['system_exec', {
    tool: 'system_exec',
    requiresApproval: true,
    riskLevel: 'high',
    autoApprovePatterns: [
      'git status',
      'git diff',
      'git log',
      'ls -la',
      'pwd',
      'cat *.md',
      'echo *'
    ]
  }]
])

export class ApprovalEngine extends EventEmitter {
  private toolPermissions: Map<string, ToolPermissionConfig>
  private userPreferences: UserPreferences
  private rememberedChoices: Map<string, 'once' | 'always'> = new Map()
  private pendingApprovals: Map<string, {
    resolve: (decision: ApprovalDecision) => void
    request: ToolCallRequest
  }> = new Map()

  constructor(customPermissions?: Map<string, ToolPermissionConfig>) {
    super()
    this.toolPermissions = customPermissions || DEFAULT_TOOL_PERMISSIONS
    this.userPreferences = {
      autoApproveLowRisk: true,
      requireConfirmation: true,
      rememberChoices: true,
      notificationLevel: 'risky'
    }
  }

  /**
   * 主入口：评估工具调用请求
   */
  async evaluate(request: ToolCallRequest): Promise<ApprovalDecision> {
    const { tool, params } = request
    const permission = this.toolPermissions.get(tool)

    // 未配置的工具，需要批准
    if (!permission) {
      return {
        approved: false,
        autoApproved: false,
        reason: `Unknown tool: ${tool}. Please configure permissions first.`
      }
    }

    // 检查沙盒约束
    const sandboxCheck = this.checkSandboxConstraints(tool, params, permission)
    if (!sandboxCheck.passed) {
      return {
        approved: false,
        autoApproved: false,
        reason: sandboxCheck.reason || 'Sandbox constraint violation'
      }
    }

    // 检查是否有记住的选择
    const choiceKey = this.getChoiceKey(request)
    if (this.rememberedChoices.has(choiceKey)) {
      const choice = this.rememberedChoices.get(choiceKey)
      if (choice === 'always') {
        return {
          approved: true,
          autoApproved: true,
          reason: 'Auto-approved (remembered user choice)'
        }
      }
    }

    // 检查自动批准模式
    if (permission.autoApprovePatterns) {
      for (const pattern of permission.autoApprovePatterns) {
        if (this.matchesRequest(request, pattern)) {
          return {
            approved: true,
            autoApproved: true,
            reason: `Auto-approved (matched pattern: ${pattern})`
          }
        }
      }
    }

    // 低风险操作 + 自动批准启用
    if (permission.riskLevel === 'low' && this.userPreferences.autoApproveLowRisk) {
      return {
        approved: true,
        autoApproved: true,
        reason: 'Auto-approved (low risk operation)'
      }
    }

    // 需要用户批准
    if (permission.requiresApproval && this.userPreferences.requireConfirmation) {
      return await this.requestUserApproval(request, permission)
    }

    // 默认批准
    return {
      approved: true,
      autoApproved: false,
      reason: 'Approved (default behavior)'
    }
  }

  /**
   * 请求用户批准
   */
  private async requestUserApproval(
    request: ToolCallRequest,
    context: ToolPermissionConfig | { reason: string }
  ): Promise<ApprovalDecision> {
    const requestId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    return new Promise((resolve) => {
      // 存储待处理的请求
      this.pendingApprovals.set(requestId, { resolve, request })

      // 发送事件到渲染进程
      const requestData = {
        requestId,
        tool: request.tool,
        params: request.params,
        riskLevel: ('riskLevel' in context ? context.riskLevel : 'medium') as 'low' | 'medium' | 'high',
        reason: 'reason' in context ? context.reason : undefined
      }
      this.sendToRenderer('approval-request', requestData)
      // 同时发射 EventEmitter 事件供 IPC 订阅使用
      this.emit('approval-request', requestData)

      // 超时自动拒绝（60秒）
      const timeout = setTimeout(() => {
        if (this.pendingApprovals.has(requestId)) {
          this.pendingApprovals.delete(requestId)
          resolve({
            approved: false,
            autoApproved: false,
            reason: 'Approval timeout (60 seconds)'
          })
        }
      }, 60000)

      // 清理超时
      this.once(`approval-resolved-${requestId}`, () => {
        clearTimeout(timeout)
      })
    })
  }

  /**
   * 处理用户响应
   */
  handleUserResponse(
    requestId: string,
    choice: 'approve' | 'deny',
    remember: 'once' | 'always'
  ): void {
    const pending = this.pendingApprovals.get(requestId)
    if (!pending) {
      console.warn(`[ApprovalEngine] No pending request for: ${requestId}`)
      return
    }

    const decision: ApprovalDecision = {
      approved: choice === 'approve',
      autoApproved: false,
      reason: choice === 'approve'
        ? `User approved (${remember})`
        : 'User denied',
      userChoice: remember
    }

    // 记住用户选择
    if (choice === 'approve' && remember === 'always') {
      const choiceKey = this.getChoiceKey(pending.request)
      this.rememberedChoices.set(choiceKey, 'always')
      console.log(`[ApprovalEngine] Remembered choice for: ${choiceKey}`)
    }

    // 清理
    this.pendingApprovals.delete(requestId)
    this.emit(`approval-resolved-${requestId}`)

    // 解除等待
    pending.resolve(decision)
  }

  /**
   * 检查沙盒约束
   */
  private checkSandboxConstraints(
    tool: string,
    params: Record<string, unknown>,
    permission: ToolPermissionConfig
  ): { passed: boolean; reason?: string } {
    if (!permission.sandboxConstraints) return { passed: true }

    const { allowedPaths, allowedUrls, maxFileSize } = permission.sandboxConstraints

    // 检查路径约束
    if (allowedPaths && params.path) {
      if (!matchesAnyPattern(params.path, allowedPaths)) {
        return {
          passed: false,
          reason: `Path not in allowed sandbox: ${params.path}`
        }
      }
    }

    // 检查 URL 约束
    if (allowedUrls && params.url) {
      if (!matchesAnyPattern(params.url, allowedUrls)) {
        return {
          passed: false,
          reason: `URL not in allowed list: ${params.url}`
        }
      }
    }

    // 检查文件大小
    if (maxFileSize && params.content) {
      const size = Buffer.byteLength(params.content, 'utf8')
      if (size > maxFileSize) {
        return {
          passed: false,
          reason: `Content too large: ${size} bytes (max: ${maxFileSize})`
        }
      }
    }

    return { passed: true }
  }

  /**
   * 生成选择键
   */
  private getChoiceKey(request: ToolCallRequest): string {
    return `${request.tool}:${JSON.stringify(request.params)}`
  }

  /**
   * 匹配请求到模式
   */
  private matchesRequest(request: ToolCallRequest, pattern: string): boolean {
    // 简化实现：将请求转换为字符串后匹配
    const requestStr = JSON.stringify(request.params)
    return matchesPattern(requestStr, pattern)
  }

  /**
   * 发送消息到渲染进程
   */
  private sendToRenderer(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  /**
   * 更新用户偏好
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences }
    console.log('[ApprovalEngine] Preferences updated:', this.userPreferences)
  }

  /**
   * 获取用户偏好
   */
  getPreferences(): UserPreferences {
    return { ...this.userPreferences }
  }

  /**
   * 清除记住的选择
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear()
    console.log('[ApprovalEngine] Cleared remembered choices')
  }

  /**
   * 订阅审批请求事件
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  onApprovalRequest(callback: (request: {
    requestId: string
    tool: string
    params: Record<string, unknown>
    riskLevel: 'low' | 'medium' | 'high'
    reason?: string
  }) => void): () => void {
    this.on('approval-request', callback)
    return () => {
      this.off('approval-request', callback)
    }
  }

  /**
   * 获取工具配置
   * @param tool 工具名称
   * @returns 工具权限配置
   */
  getToolConfig(tool: string): ToolPermissionConfig | undefined {
    return this.toolPermissions.get(tool)
  }
}
