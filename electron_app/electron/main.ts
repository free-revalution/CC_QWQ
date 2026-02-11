import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import pkg from 'node-pty'
import type { IPty } from 'node-pty'
import { OperationLogger } from './operationLogger.js'
import { ApprovalEngine } from './approvalEngine.js'
import { OperationExecutor } from './operationExecutor.js'
import { CheckpointManager } from './checkpointManager.js'
import { RollbackEngine } from './rollbackEngine.js'
import { LogExporter } from './logExporter.js'
import { MCPProxyServer } from './mcpProxyServer.js'
import { getBrowserManager } from './browserManager.js'
import type { LogFilter } from '../src/types/operation.js'

const { spawn: spawnPty } = pkg

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// ==================== Happy 架构改进 - 类型定义 ====================

/**
 * 工具调用状态
 */
type ToolCallState = 'running' | 'completed' | 'error' | 'pending'

/**
 * 工具调用接口
 */
interface ToolCall {
  name: string
  state: ToolCallState
  input: any
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  description: string | null
  result?: any
  permission?: ToolPermission
}

/**
 * 权限决策信息
 */
interface ToolPermission {
  id: string
  status: 'pending' | 'approved' | 'denied' | 'canceled'
  reason?: string
  mode?: string
  allowedTools?: string[]
  decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
  date?: number
}

/**
 * 会话状态
 */
interface SessionState {
  sessionId: string
  claudeStatus: 'not_started' | 'initializing' | 'ready'
  controlledByUser: boolean
  activeToolCalls: Map<string, ToolCall>
  lastActivity: number
  thinking: boolean
  thinkingAt: number
  activeAt: number
}

/**
 * 活动状态更新
 */
interface ActivityUpdate {
  type: 'activity'
  sessionId: string
  active: boolean
  activeAt: number
  thinking?: boolean
  thinkingAt?: number
}

// ==================== 工具函数 ====================

/**
 * 清理 ANSI 转义码（包括所有控制序列）
 * 增强版本：捕获更多类型的转义序列残留
 */
/* eslint-disable no-control-regex */
function stripAnsiCodes(text: string): string {
  let result = text

  // CSI (Control Sequence Introducer) 序列: ESC [ ...
  result = result.replace(/\x1b\[[0-9;]*[mGKH]/g, '')
  result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
  result = result.replace(/\x1b\[[0-9;]*R/g, '')

  // DEC 私有模式序列: ESC [ ? ...
  result = result.replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
  result = result.replace(/\x1b\[\?[0-9;]*/g, '') // 捕获不完整的序列如 [?2026l

  // OSC (Operating System Command) 序列: ESC ] ... BEL
  result = result.replace(/\x1b\][0-9];[^\x07]*\x07/g, '')

  // 其他常见转义序列
  result = result.replace(/\x1b[=>]/g, '')

  // 字符集选择序列 (B, 0, U, K 等)
  result = result.replace(/\x1b\([A-Z]/g, '') // ESC ( B
  result = result.replace(/\x1b\)[A-Z]/g, '') // ESC ) B

  // 捕获残留的颜色代码片段（清理后残留的）
  // 例如: [38;2;153;153;153m? 或 38;2;153;153;153m
  result = result.replace(/\[\d{2};\d+;\d+[m?]/g, '')
  result = result.replace(/\[\d+;\d+;\d+m/g, '')
  result = result.replace(/\d{2};\d+;\d+[m?]/g, '')

  // 退格符
  result = result.replace(/\x08/g, '')

  // 统一换行符
  result = result.replace(/\r\n/g, '\n')
  result = result.replace(/\r/g, '\n')

  return result
}
/* eslint-enable no-control-regex */

/**
 * 检测是否包含信任文件夹提示
 */
function detectTrustPrompt(text: string): boolean {
  const cleaned = stripAnsiCodes(text)
  return cleaned.includes('Do you trust the files in this folder?') ||
         cleaned.includes('Claude Code may read, write, or execute files')
}

/**
 * 检测是否包含权限请求提示（只检测真正的权限请求，不是正常对话）
 */
function detectPermissionPrompt(text: string): { hasPrompt: boolean; toolName?: string; details?: string; promptType?: 'edit' | 'write' | 'generic' } {
  const cleaned = stripAnsiCodes(text)

  // 检测 "Do you want to make this edit to" 模式（文件编辑权限）
  if (cleaned.includes('Do you want to make this edit to') && cleaned.includes('?')) {
    return {
      hasPrompt: true,
      toolName: 'Write',
      details: cleaned.slice(0, 500),
      promptType: 'edit'
    }
  }

  // 检测通用权限提示模式
  const patterns = [
    { regex: /allow.*write.*file.*to.*path/i, tool: 'Write' },
    { regex: /allow.*read.*file.*from.*path/i, tool: 'Read' },
    { regex: /allow.*execution.*of.*command/i, tool: 'Bash' },
    { regex: /allow.*editing.*file/i, tool: 'Edit' },
    { regex: /execute.*bash.*command/i, tool: 'Bash' },
    { regex: /write.*to.*file/i, tool: 'Write' },
  ]

  for (const pattern of patterns) {
    if (pattern.regex.test(cleaned)) {
      return { hasPrompt: true, toolName: pattern.tool, details: cleaned.slice(0, 200), promptType: 'generic' }
    }
  }

  return { hasPrompt: false }
}

/**
 * 检测是否是提示符（用于判断初始化完成或响应完成）
 *
 * Claude Code 的提示符是 "❯ "，必须严格匹配：
 * - 必须包含 "❯" 字符
 * - "❯" 后面通常有空格或换行
 * - 不应该包含其他大量内容
 *
 * @param text - 要检测的文本
 * @param isInitializing - 是否在初始化阶段（初始化阶段需要更宽松的检测，因为欢迎界面包含大量UI元素）
 */
function isPromptIndicator(text: string, isInitializing = false): boolean {
  if (!text) return false

  const cleaned = stripAnsiCodes(text)

  // 必须包含 "❯" 字符
  if (!cleaned.includes('❯')) {
    return false
  }

  // ==================== 非初始化阶段的严格检测 ====================
  if (!isInitializing) {
    // 检查是否包含大量边框字符（说明是欢迎界面重绘，不是真正的响应完成）
    const borderCount = (cleaned.match(/─/g) || []).length
    if (borderCount > 5) {
      console.log('[isPromptIndicator] ✗ Too many border characters, ignoring as welcome screen redraw')
      return false
    }

    // 检查是否包含欢迎界面特征（API Usage, GLM等）
    if (cleaned.includes('API Usage') || cleaned.includes('GLM') ||
        cleaned.includes('Billing') || cleaned.includes('Tips for getting started')) {
      console.log('[isPromptIndicator] ✗ Contains welcome screen indicators')
      return false
    }

    // 检查是否包含 ASCII 艺术字符
    const artChars = (cleaned.match(/[▐▛▜▝▘▗▖]/g) || []).length
    if (artChars > 3) {
      console.log('[isPromptIndicator] ✗ Contains ASCII art characters')
      return false
    }
  }

  // ==================== 检查提示符 ====================
  const lines = cleaned.split('\n')

  // 查找提示符行（❯ 开头的行）
  for (const line of lines) {
    const trimmed = line.trim()

    // 空行跳过
    if (trimmed.length === 0) {
      continue
    }

    // 在初始化阶段，跳过包含边框字符的行
    if (isInitializing) {
      if (trimmed.includes('─') || trimmed.includes('│') || trimmed.includes('╭') ||
          trimmed.includes('╮') || trimmed.includes('╰') || trimmed.includes('╯')) {
        continue
      }
    }

    // 检测提示符：必须以 "❯" 开头
    if (trimmed.startsWith('❯')) {
      // 提示符行应该很短（通常小于30字符）
      if (trimmed.length < 30) {
        // 进一步检查：如果包含其他内容（如命令），也认为是提示符
        // 但如果是纯提示符（❯ 或 ❯ ），那更确定
        console.log('[isPromptIndicator] ✓ Found prompt:', JSON.stringify(trimmed), '(initializing:', isInitializing, ')')
        return true
      }
    }
  }

  console.log('[isPromptIndicator] ✗ No prompt found', '(initializing:', isInitializing, ')')
  return false
}

/**
 * 检查一行是否应该被过滤（返回 true 表示应该过滤）
 * 返回 { deduplicate: true } 表示需要去重的状态行（不删除，但检查重复）
 * 返回 { resetDeduplication: true } 表示这是新的操作状态，需要重置去重集合
 *
 * 注意：resetDeduplication 只在操作类型真正变化时返回（如从 ✻ 变成 ⏺），
 *       而不是状态内容变化（如从 ✻ Forging 变成 ✻ Forging (thinking)）
 */
function shouldFilterLine(line: string, trimmed: string): { filter: boolean; deduplicate?: boolean; resetDeduplication?: boolean; reason?: string } {
  // 1. 空行 - 保留（用于维持格式）
  if (trimmed.length === 0) {
    return { filter: false }
  }

  // 2. 纯边框线（占比超过80%认为是边框线）
  const borderChars = (trimmed.match(/[─│╭╮╰╯]/g) || []).length
  if (trimmed.length > 0 && borderChars / trimmed.length > 0.8) {
    return { filter: true, reason: 'border' }
  }

  // 3. 用户输入逐字显示 - `❯ ` 开头的行（包括空提示符）
  if (trimmed.startsWith('❯')) {
    return { filter: true, reason: 'user-input-display' }
  }

  // 4. Claude 操作状态指示符 - 需要显示但去重，并且重置去重集合
  // 4a. `✻` 开头的行（Proofing、Nesting 等状态）
  if (trimmed.startsWith('✻')) {
    return { filter: false, deduplicate: true, resetDeduplication: false, reason: 'operation-status-asterisk' }
  }

  // 4b. `⏺` 开头的行（工具操作如 Write、Read）- 这个会重置去重集合，因为表示新的操作开始
  if (trimmed.startsWith('⏺')) {
    return { filter: false, deduplicate: true, resetDeduplication: true, reason: 'operation-status-circle' }
  }

  // 4c. `·` 开头的行（初始状态指示符）- 需要去重，不重置集合
  if (trimmed.startsWith('·')) {
    return { filter: false, deduplicate: true, resetDeduplication: false, reason: 'operation-status-dot' }
  }

  // 4d. `◯` 开头或包含 `◯` 的行（IDE 状态指示符）- 完全过滤
  // 检查原始行（因为 ANSI 转义码可能干扰）
  if (line.includes('◯')) {
    return { filter: true, reason: 'ide-status' }
  }

  // 4e. 包含 `(esc to interrupt` 的行 - 这些通常是状态行的一部分，跟随对应的状态符号处理
  if (trimmed.includes('(esc to interrupt')) {
    return { filter: false, deduplicate: true, resetDeduplication: false, reason: 'operation-status-interrupt' }
  }

  // 5. Tip 提示 - 需要显示但去重
  if (trimmed.startsWith('⎿') || trimmed.startsWith('  ⎿')) {
    return { filter: false, deduplicate: true, reason: 'tip' }
  }

  // 6. 文件编辑和保存提示 - 需要显示但去重
  if (trimmed.includes('Opened changes in Visual Studio Code') ||
      trimmed.includes('Save file to continue') ||
      trimmed.includes('Esc to cancel')) {
    return { filter: false, deduplicate: true, reason: 'edit-prompt' }
  }

  // 7. 其他控制提示 - 需要显示但去重
  if (trimmed.includes('ctrl+g to edit') ||
      trimmed.includes('Skedaddling') ||
      trimmed.includes('? for shortcuts')) {
    return { filter: false, deduplicate: true, reason: 'control-hint' }
  }

  // 8. ASCII 艺术（只包含特殊字符的行）
  const artChars = (trimmed.match(/[▐▛▜▝▘▗▖]/g) || []).length
  if (trimmed.length > 0 && artChars / trimmed.length > 0.7) {
    return { filter: true, reason: 'ascii-art' }
  }

  // 9. 颜色代码残留（如 `38;2;153;1` 或 `[38;2;153;153;153`）
  if (/^\d+;\d+;\d+m$/.test(trimmed)) {
    return { filter: true, reason: 'color-code-fragment' }
  }
  // 捕获 `[38;2;153;153;153` 或 `38;2;153;153;153` 风格的颜色代码残留
  if (/^\[?\d{1,2};\d+;\d+m?$/.test(trimmed)) {
    return { filter: true, reason: 'color-code-fragment' }
  }

  // 10. 版权符号或控制字符残留
  // 检查单符号或以 ⧉ 开头的行（如 "⧉ In ..."）
  // 检查原始行，因为 ANSI 转义码可能干扰
  if (trimmed === '©' || trimmed === '®' || trimmed === '⧉' || trimmed.startsWith('⧉') || line.includes('⧉')) {
    return { filter: true, reason: 'symbol-fragment' }
  }

  return { filter: false }
}

/**
 * Talk 模式过滤：只保留 Claude 的实际回复，过滤掉所有思考过程和状态行
 *
 * 规则：
 * 1. 过滤掉所有状态符号（·✻◯⎿等）
 * 2. 过滤掉工具操作（⏺ ToolName(...)）
 * 3. 保留实际回复（⏺ 文本内容）
 * 4. 保留实际回复后的普通文本行
 * 5. 遇到新的状态符号时停止保留
 */
function filterForTalkMode(content: string): string {
  if (!content) return ''

  const lines = content.split('\n')
  const filtered: string[] = []
  let keepingResponseContent = false

  // 工具操作检测正则
  const toolOperationPattern = /^⏺\s*(Read|Write|Edit|Bash|WebFetch|Glob|Grep|NotebookEdit|Task|AskUserQuestion|Skill)\s*\(/

  // 状态符号检测正则
  const statusSymbolPattern = /([·✻◯⎿]|ctrl\+g|\? for shortcuts|\(esc to interrupt)/

  console.log('[Talk Mode] ===== Starting Filter =====')
  console.log('[Talk Mode] Input lines:', lines.length)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    console.log(`[Talk Mode] Line ${i}:`, JSON.stringify(line.slice(0, 80)), 'trimmed:', JSON.stringify(trimmed.slice(0, 80)))

    // 空行处理：在保留状态中保留，否则过滤
    if (trimmed.length === 0) {
      if (keepingResponseContent) {
        filtered.push(line)
        console.log('[Talk Mode] ✓ Keeping empty line in response')
      } else {
        console.log('[Talk Mode] ✗ Skipping empty line before response')
      }
      continue
    }

    // 检查是否以 ⏺ 开头
    if (trimmed.startsWith('⏺')) {
      // 检查是否是工具操作
      if (toolOperationPattern.test(line)) {
        console.log('[Talk Mode] ✗ Tool operation, filtering')
        continue
      }

      // 这是实际回复，开始保留
      console.log('[Talk Mode] ✓ Found actual response start')
      keepingResponseContent = true
      // 去掉 ⏺ 前缀
      const cleanedLine = line.replace(/^⏺\s*/, '')
      if (cleanedLine.trim()) {
        filtered.push(cleanedLine)
        console.log('[Talk Mode] ✓ Added response line:', JSON.stringify(cleanedLine.slice(0, 80)))
      }
      continue
    }

    // 如果正在保留回复内容
    if (keepingResponseContent) {
      // 检查是否包含状态符号
      if (statusSymbolPattern.test(line)) {
        console.log('[Talk Mode] ✗ Status symbol found, stopping')
        keepingResponseContent = false
        continue
      }

      // 保留实际回复内容
      filtered.push(line)
      console.log('[Talk Mode] ✓ Keeping content line:', JSON.stringify(line.slice(0, 80)))
      continue
    }

    // 还没遇到实际回复，过滤掉
    console.log('[Talk Mode] ✗ Skipping before response')
  }

  const result = filtered.join('\n')
  console.log('[Talk Mode] Output lines:', filtered.length, 'preview:', JSON.stringify(result.slice(0, 150)))
  console.log('[Talk Mode] ===== Filter Complete =====')

  return result
}

/**
 * Develop 模式过滤：保留操作过程，但去重状态行
 */
function filterForDevelopMode(content: string, statusLinesSet: Set<string>): { content: string; newStatusLines: Set<string> } {
  if (!content) return { content: '', newStatusLines: statusLinesSet }

  const lines = content.split('\n')
  const filtered: string[] = []
  const skippedReasons = new Map<string, number>()
  const newStatusLines = new Set<string>(statusLinesSet)

  console.log('[Develop Mode] ===== Starting Filter =====')
  console.log('[Develop Mode] Input lines:', lines.length, 'existing status lines:', statusLinesSet.size)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const { filter, deduplicate, resetDeduplication, reason } = shouldFilterLine(line, trimmed)

    // 如果需要过滤
    if (filter) {
      if (reason) {
        skippedReasons.set(reason, (skippedReasons.get(reason) || 0) + 1)
      }
      continue
    }

    // 检查是否需要重置去重集合
    if (resetDeduplication) {
      console.log('[Develop Mode] Resetting status lines set')
      newStatusLines.clear()
    }

    // 检查是否需要去重
    if (deduplicate) {
      if (newStatusLines.has(trimmed)) {
        console.log('[Develop Mode] ✗ Duplicate status line:', JSON.stringify(trimmed.slice(0, 80)))
        skippedReasons.set(`${reason}-deduplicated`, (skippedReasons.get(`${reason}-deduplicated`) || 0) + 1)
        continue
      }
      // 首次发送，记录到集合中
      console.log('[Develop Mode] ✓ Adding status line to set:', JSON.stringify(trimmed.slice(0, 80)))
      newStatusLines.add(trimmed)
    }

    // 保留内容
    filtered.push(line)
  }

  // 日志输出
  if (skippedReasons.size > 0) {
    const reasonStr = Array.from(skippedReasons.entries())
      .map(([reason, count]) => `${reason}:${count}`)
      .join(', ')
    console.log('[Develop Mode] Skipped:', reasonStr)
  }

  const result = filtered.join('\n')
  console.log('[Develop Mode] Output lines:', filtered.length, 'preview:', JSON.stringify(result.slice(0, 150)))
  console.log('[Develop Mode] ===== Filter Complete =====')

  return { content: result, newStatusLines }
}

/**
 * 过滤终端UI元素（边框、横线等），只保留实际内容
 * 对状态行进行去重处理（显示但不重复发送）
 * 当遇到新的操作状态时（resetDeduplication: true），重置去重集合
 *
 * 注意：这个函数应该在响应阶段使用，用于过滤掉欢迎界面重绘等UI元素
 * 初始化阶段不需要过滤，因为需要检测欢迎界面本身
 *
 * @param content 要过滤的内容
 * @param statusLinesSet 状态行去重集合
 * @param filterMode 过滤模式：'talk' 只显示回复文本，'develop' 显示操作过程
 */
function filterTerminalUI(content: string, statusLinesSet: Set<string>, filterMode: 'talk' | 'develop' = 'develop'): { content: string; newStatusLines: Set<string> } {
  if (!content) return { content: '', newStatusLines: statusLinesSet }

  console.log('[filterTerminalUI] Dispatching to filter mode:', filterMode)

  if (filterMode === 'talk') {
    // Talk 模式：使用专用的 Talk 模式过滤函数
    const filteredContent = filterForTalkMode(content)
    return { content: filteredContent, newStatusLines: statusLinesSet }
  } else {
    // Develop 模式：使用专用的 Develop 模式过滤函数
    return filterForDevelopMode(content, statusLinesSet)
  }
}

/**
 * 格式化内容以适配聊天气泡显示
 *
 * 处理规则：
 * - 移除多余空行（最多保留2个连续空行）
 * - 移除每行首尾空格（但保留表格格式的对齐空格）
 * - 移除单独的符号残留
 * - 保留表格格式的行（包含多个连续空格或边框字符的行）
 */
function formatForChatBubble(content: string): string {
  if (!content) return ''

  const lines = content.split('\n')
  const formatted: string[] = []
  let emptyLineCount = 0

  // 检测是否是表格格式行（包含边框字符或多个连续空格）
  const isTableFormatLine = (line: string): boolean => {
    const trimmed = line.trim()
    // 包含表格边框字符
    if (/[│┌┐└┘─├┤┬┴┼╭╮╰╯]/.test(line)) return true
    // 包含多个连续空格（可能是对齐的表格列）
    if (/\s{3,}/.test(line)) return true
    // 包含管道符作为列分隔符
    if (trimmed.includes('|') && trimmed.split('|').length >= 3) return true
    return false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行处理：最多保留2个连续空行
    if (trimmed.length === 0) {
      emptyLineCount++
      if (emptyLineCount <= 2) {
        formatted.push('')  // 保留空行但清理内容
      }
      continue
    }

    // 重置空行计数
    emptyLineCount = 0

    // 移除单独的符号残留（单字符且无意义）
    if (trimmed.length === 1 && /[⧉©®]/.test(trimmed)) {
      continue
    }

    // 表格格式行：保留原始空格（只移除首尾空格）
    if (isTableFormatLine(line)) {
      formatted.push(line.trimEnd()) // 移除尾部空格，保留内部空格
    } else {
      // 普通行：清理首尾空格
      formatted.push(trimmed)
    }
  }

  // 移除末尾的空行
  while (formatted.length > 0 && formatted[formatted.length - 1] === '') {
    formatted.pop()
  }

  const result = formatted.join('\n')

  // 调试日志
  if (result !== content) {
    console.log('[formatForChatBubble] Formatted:', {
      originalLines: content.split('\n').length,
      formattedLines: formatted.length,
      originalPreview: JSON.stringify(content.slice(0, 100)),
      formattedPreview: JSON.stringify(result.slice(0, 100))
    })
  }

  return result
}

/**
 * 检测是否包含欢迎信息（确认 Claude Code 已完全启动）
 */
function hasWelcomeMessage(text: string): boolean {
  const cleaned = stripAnsiCodes(text).toLowerCase()
  // 检测 Claude Code 欢迎界面的关键内容
  return cleaned.includes('claude code') ||
         cleaned.includes('welcome') ||
         cleaned.includes('getting started') ||
         (cleaned.includes('api usage') && cleaned.includes('billing'))
}

// 超时时间（毫秒）- 30秒超时，给Claude足够时间响应
const RESPONSE_TIMEOUT = 30000

/**
 * 启动或重置超时定时器
 */
function resetTimeoutTimer(session: ClaudeSession, conversationId: string): void {
  // 清除现有定时器
  if (session.timeoutTimer) {
    clearTimeout(session.timeoutTimer)
  }

  // 更新最后接收数据时间
  session.lastDataTime = Date.now()

  // 设置新的定时器
  session.timeoutTimer = setTimeout(() => {
    const currentMessageId = activeMessageId.get(conversationId)
    if (currentMessageId && session.state === 'processing') {
      console.log('=== Response Timeout Check ===')
      console.log('Timeout reached after', RESPONSE_TIMEOUT, 'ms')
      console.log('Conversation ID:', conversationId)
      console.log('PTY PID:', session.terminal.pid)
      console.log('Buffer length:', session.buffer.length)
      console.log('Has received real content:', session.hasReceivedRealContent)
      console.log('Buffer content preview:', JSON.stringify(session.buffer.slice(0, 500)))

      // 检查PTY进程是否还在运行
      let isPtyAlive = false
      try {
        process.kill(session.terminal.pid, 0) // 发送信号0检查进程是否存在
        isPtyAlive = true
        console.log('✓ PTY process is still running (PID:', session.terminal.pid, ')')
      } catch {
        console.log('✗ PTY process is NOT running (PID:', session.terminal.pid, ')')
      }

      // 如果PTY进程死了，尝试重新创建会话
      if (!isPtyAlive) {
        console.log('[Claude] PTY process died, attempting to recreate session...')

        // 从会话映射中移除旧会话
        claudeSessions.delete(conversationId)

        try {
          // 重新创建会话
          const newSession = getOrCreateClaudeSession(conversationId, session.projectPath)
          console.log('[Claude] New session created with PID:', newSession.terminal.pid)

          // 发送错误消息给前端
          if (mainWindow) {
            mainWindow.webContents.send('claude-stream', {
              conversationId,
              messageId: currentMessageId,
              type: 'content',
              content: '\n[System] Connection to Claude was lost. Reconnecting...',
              timestamp: Date.now(),
            })
          }

          // 等待新会话初始化完成
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.webContents.send('claude-stream', {
                conversationId,
                messageId: currentMessageId,
                type: 'done',
                content: '',
                timestamp: Date.now(),
              })
            }
            session.state = 'ready'
            session.lastUserMessage = undefined
            session.hasReceivedRealContent = false
            activeMessageId.delete(conversationId)

            // ==================== Happy 架构改进 - 超时，清除思考状态 ====================
            sessionStateManager.setThinking(conversationId, false)
            sessionStateManager.setClaudeStatus(conversationId, 'ready')

            // session 状态变化时广播给移动端
            scheduleBroadcastConversationList()
          }, 3000)

          return
        } catch (recreateError) {
          console.error('[Claude] Failed to recreate session:', recreateError)
        }
      }

      // PTY进程还在运行，但超时了
      // 检查是否收到了任何内容
      if (session.hasReceivedRealContent) {
        console.log('[Claude] Timeout but some content was received, sending done event')
        if (mainWindow) {
          mainWindow.webContents.send('claude-stream', {
            messageId: currentMessageId,
            type: 'done',
            content: '',
            timestamp: Date.now(),
          })
        }
      } else {
        // 没有收到任何内容，可能是PTY卡住了
        console.log('[Claude] Timeout with no content received, PTY might be stuck')
        if (mainWindow) {
          mainWindow.webContents.send('claude-stream', {
            conversationId,
            messageId: currentMessageId,
            type: 'content',
            content: '\n[System] Request timed out. Please try again.',
            timestamp: Date.now(),
          })
          setTimeout(() => {
            // 报错位置 - 添加 null 检查
            if (mainWindow) {
              mainWindow.webContents.send('claude-stream', {
                conversationId,
                messageId: currentMessageId,
                type: 'done',
                content: '',
                timestamp: Date.now(),
              })
            }
          }, 100)
        }
      }

      // 清空状态
      session.state = 'ready'
      session.lastUserMessage = undefined
      session.hasReceivedRealContent = false
      activeMessageId.delete(conversationId)

      // session 状态变化时广播给移动端
      scheduleBroadcastConversationList()

      console.log('=== Timeout Handler Complete ===')
    }
  }, RESPONSE_TIMEOUT)
}

// WebSocket 类型定义
interface WebSocketClient {
  readyState: number
  send: (data: string) => void
  close: () => void
  on: {
    (event: 'message', callback: (data: string | Buffer) => void): void
    (event: 'error', callback: (error: Error) => void): void
    (event: 'close', callback: () => void): void
  }
  selectedConversationId?: string  // 新增：移动端选择的 conversationId
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface WebSocketServer {
  close: () => void
  on: (event: string, callback: (ws: WebSocketClient) => void) => void
}

// Claude 交互会话
interface ClaudeSession {
  terminal: IPty  // node-pty 终端实例
  conversationId: string  // 对话 ID（主键）
  projectPath: string  // 项目路径（工作目录）
  buffer: string  // 输出缓冲区
  state: 'initializing' | 'ready' | 'processing' | 'waiting_trust' | 'waiting_permission'  // 会话状态
  lastUserMessage?: string  // 用户发送的最后一条消息（用于过滤 echo）
  timeoutTimer?: NodeJS.Timeout  // 超时定时器
  lastDataTime?: number  // 上次接收数据的时间
  isInitialized: boolean  // 是否已完成初始化（欢迎界面已显示完成）
  initializedAt?: number  // 初始化完成的时间戳
  createdAt: number  // 会话创建时间
  hasReceivedRealContent: boolean  // 当前消息是否已收到实际内容（用于区分UI重绘和真实响应）
  requestQueue: Array<{ conversationId: string; projectPath: string; message: string; resolve: (messageId: string) => void; reject: (error: Error) => void }>  // 请求队列
  isProcessingQueue: boolean  // 是否正在处理队列中的请求
  lastSentContent: string  // 上次发送给前端的内容（用于去重）
  lastStatusLines: Set<string>  // 上次发送的状态行（用于去重操作状态指示）
  filterMode: 'talk' | 'develop'  // 过滤模式：talk 只显示回复文本，develop 显示操作过程
}

let mainWindow: BrowserWindow | null
let linkPassword: string = ''
let currentProjectPath: string = '' // 存储当前项目路径
const mobileClients = new Set<WebSocketClient>() // 存储所有连接的移动客户端
let chatHistory: ChatMessage[] = [] // 存储聊天历史（用于同步给移动端）
const PORT = 3000

// 操作日志系统
export const operationLogger = new OperationLogger()

// 审批引擎
export const approvalEngine = new ApprovalEngine()

// 检查点管理器
export let checkpointManager: CheckpointManager

// 回滚引擎
export let rollbackEngine: RollbackEngine

// WebSocket 服务器实例
let wss: WebSocketServer | null = null

// Claude 会话管理器 - 以对话 ID 为 key（每个对话独立的 PTY 会话）
const claudeSessions = new Map<string, ClaudeSession>()

// 当前活跃的消息 ID（用于流式输出匹配）
const activeMessageId = new Map<string, string>() // conversationId -> messageId

// 反向查找：对话 ID -> 项目路径（用于清理和调试）
const conversationProjectMap = new Map<string, string>()

// ==================== Happy 架构改进 - 状态管理器 ====================

/**
 * 活动状态累积器
 * 将短时间内的多次状态更新合并为一次批量发送
 */
class ActivityAccumulator {
  private updates: Map<string, ActivityUpdate> = new Map()
  private timer: NodeJS.Timeout | null = null
  private flushInterval: number
  private flushCallback: (updates: ActivityUpdate[]) => void

  constructor(flushCallback: (updates: ActivityUpdate[]) => void, flushInterval: number = 2000) {
    this.flushCallback = flushCallback
    this.flushInterval = flushInterval
  }

  addUpdate(sessionId: string, update: Partial<ActivityUpdate>): void {
    const existing = this.updates.get(sessionId)
    const now = Date.now()

    this.updates.set(sessionId, {
      type: 'activity',
      sessionId,
      active: update.active ?? existing?.active ?? true,
      activeAt: now,
      thinking: update.thinking,
      thinkingAt: update.thinkingAt ? now : existing?.thinkingAt
    })

    // 重置计时器
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => this.flush(), this.flushInterval)
  }

  private flush(): void {
    if (this.updates.size === 0) return

    const updates = Array.from(this.updates.values())
    this.updates.clear()

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.flushCallback(updates)
  }

  flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.flush()
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.updates.clear()
  }
}

/**
 * 会话状态管理器
 */
class SessionStateManager {
  private states: Map<string, SessionState> = new Map()
  private activityAccumulator: ActivityAccumulator

  constructor(mobileClients: Set<WebSocketClient>) {
    this.activityAccumulator = new ActivityAccumulator(
      (updates) => this.broadcastActivityUpdates(updates),
      2000
    )
  }

  getOrCreate(sessionId: string): SessionState {
    if (!this.states.has(sessionId)) {
      this.states.set(sessionId, {
        sessionId,
        claudeStatus: 'not_started',
        controlledByUser: true,
        activeToolCalls: new Map(),
        lastActivity: Date.now(),
        thinking: false,
        thinkingAt: 0,
        activeAt: Date.now()
      })
    }
    return this.states.get(sessionId)!
  }

  get(sessionId: string): SessionState | undefined {
    return this.states.get(sessionId)
  }

  update(sessionId: string, updates: Partial<SessionState>): void {
    const state = this.getOrCreate(sessionId)
    Object.assign(state, updates)

    if (updates.claudeStatus || updates.thinking !== undefined) {
      state.activeAt = Date.now()
    }

    this.activityAccumulator.addUpdate(sessionId, {
      active: true,
      activeAt: state.activeAt,
      thinking: state.thinking,
      thinkingAt: state.thinking > 0 ? state.thinkingAt : undefined
    })
  }

  setThinking(sessionId: string, thinking: boolean): void {
    const state = this.getOrCreate(sessionId)
    state.thinking = thinking
    state.thinkingAt = thinking ? Date.now() : 0
    state.activeAt = Date.now()

    this.activityAccumulator.addUpdate(sessionId, {
      active: true,
      activeAt: state.activeAt,
      thinking,
      thinkingAt: thinking ? state.thinkingAt : undefined
    })
  }

  setClaudeStatus(sessionId: string, status: 'not_started' | 'initializing' | 'ready'): void {
    this.update(sessionId, { claudeStatus: status })
  }

  private broadcastActivityUpdates(updates: ActivityUpdate[]): void {
    // 发送给移动端 WebSocket 客户端
    mobileClients.forEach(client => {
      if (client.readyState === 1) {  // WebSocket.OPEN
        updates.forEach(update => {
          try {
            client.send(JSON.stringify(update))
          } catch (error) {
            console.error('[SessionStateManager] Failed to send activity update:', error)
          }
        })
      }
    })

    // 发送给桌面端渲染进程
    if (mainWindow && mainWindow.webContents) {
      updates.forEach(update => {
        mainWindow.webContents.send('activity-update', update)
      })
    }
  }

  flushActivityUpdates(): void {
    this.activityAccumulator.flushNow()
  }

  remove(sessionId: string): void {
    this.states.delete(sessionId)
  }
}

// 创建会话状态管理器实例
const sessionStateManager = new SessionStateManager(mobileClients)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#F5F5F7',
    show: false, // 等待页面加载完成后再显示窗口
    titleBarStyle: 'hiddenInset', // macOS 样式：隐藏标题栏背景但保留红绿灯按钮，内容延伸到标题栏区域
    frame: process.platform !== 'darwin', // 在 macOS 上使用原生 frame，其他平台隐藏
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 开发模式禁用 web 安全
    },
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    // 开发模式：从 Vite 开发服务器加载
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产模式：从打包后的文件加载
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 页面加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// WebSocket ready state constant
const WS_READY_STATE_OPEN = 1

// Debounced broadcast mechanism
let broadcastScheduled = false
let broadcastTimeout: NodeJS.Timeout | null = null

const scheduleBroadcastConversationList = () => {
  if (broadcastScheduled) {
    return // Already scheduled, skip duplicate
  }

  broadcastScheduled = true
  broadcastTimeout = setTimeout(() => {
    broadcastConversationList()
    broadcastScheduled = false
    broadcastTimeout = null
  }, 100) // Debounce for 100ms
}

// 发送 conversation 列表给移动端
function sendConversationList(ws: WebSocketClient) {
  try {
    const conversations = Array.from(claudeSessions.entries()).map(([id, session]) => {
      let status: 'not_started' | 'initializing' | 'ready' = 'not_started'
      if (session.isInitialized) {
        status = session.state === 'ready' ? 'ready' : 'initializing'
      }

      return {
        id,
        title: id,
        status,
        lastMessage: session.lastUserMessage || undefined,
        updatedAt: session.lastUserMessage ? Date.now() : 0
      }
    })

    ws.send(JSON.stringify({
      type: 'conversation-list',
      data: { conversations }
    }))

    console.log('[WebSocket] Sent conversation list to mobile client:', conversations.length, 'conversations')
  } catch (error) {
    console.error('[WebSocket] Failed to send conversation list:', error)
  }
}

// 广播 conversation 列表更新给所有连接的移动端
function broadcastConversationList() {
  let successCount = 0
  mobileClients.forEach(client => {
    if (client.readyState === WS_READY_STATE_OPEN) {
      try {
        sendConversationList(client)
        successCount++
      } catch (error) {
        console.error('[WebSocket] Failed to broadcast conversation list to client:', error)
      }
    }
  })
  console.log('[WebSocket] Broadcasted conversation list to', successCount, 'of', mobileClients.size, 'clients')
}

// 启动 WebSocket 服务器
async function startWebSocketServer() {
  try {
    // 关闭现有服务器
    if (wss) {
      wss.close()
      wss = null
    }

    // 使用 createRequire 加载 CommonJS 版本的 ws
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const WebSocketServer = require('ws').Server
    wss = new WebSocketServer({ port: PORT })

    // 处理连接事件
    if (wss && typeof wss.on === 'function') {
      wss.on('connection', (ws: WebSocketClient) => {
        console.log('Mobile client connected')

        // 认证状态
        let isAuthenticated = false
        let hasCompletedAuth = false // 标记是否已完成认证流程

        // 发送认证成功和历史的辅助函数
        const completeAuth = () => {
          isAuthenticated = true
          hasCompletedAuth = true
          mobileClients.add(ws)
          ws.send(JSON.stringify({ type: 'auth', success: true }))
          console.log('Client authenticated successfully')

          // 发送 conversation 列表
          setTimeout(() => {
            if (ws.readyState === WS_READY_STATE_OPEN) { // 确保连接还活着
              sendConversationList(ws)
            } else {
              console.log('Client disconnected before conversation list could be sent')
            }
          }, 100)

          // 发送聊天历史 - 使用 setTimeout 避免阻塞
          setTimeout(() => {
            if (ws.readyState === WS_READY_STATE_OPEN) { // 确保连接还活着
              sendChatHistory(ws)
            } else {
              console.log('Client disconnected before history could be sent')
            }
          }, 200)
        }

        // 如果没有设置密码，自动认证
        if (!linkPassword) {
          console.log('No password set, auto-authenticating')
          completeAuth()
        }

        // 处理消息事件
        if (typeof ws.on === 'function') {
          ws.on('message', async (data: Buffer | string) => {
            try {
              // 解析消息
              const messageStr = typeof data === 'string' ? data : data.toString()
              const message = JSON.parse(messageStr)
              console.log('Server received message type:', message.type)

              if (message.type === 'auth') {
                // 如果已经完成认证流程，忽略后续的auth消息
                if (hasCompletedAuth) {
                  console.log('Auth already completed, ignoring duplicate auth message')
                  return
                }

                // 验证密码
                if (message.password === linkPassword) {
                  completeAuth()
                } else {
                  hasCompletedAuth = true
                  isAuthenticated = false
                  ws.send(JSON.stringify({ type: 'auth', success: false }))
                  console.log('Auth failed: incorrect password')
                  ws.close()
                }
              } else if (message.type === 'select-conversation') {
                // 必须已认证
                if (!isAuthenticated) {
                  console.log('[WebSocket] select-conversation received before authentication, ignoring')
                  return
                }

                // 验证消息格式
                if (!message.data?.conversationId || typeof message.data.conversationId !== 'string') {
                  console.log('[WebSocket] Invalid message format for select-conversation')
                  return
                }

                // 移动端选择了某个 conversation
                ws.selectedConversationId = message.data.conversationId
                console.log('[WebSocket] Mobile client selected conversation:', message.data.conversationId)

                try {
                  broadcastConversationList()
                } catch (error) {
                  console.error('[WebSocket] Failed to broadcast conversation list:', error)
                }
              } else if (message.type === 'message') {
                // 必须已认证
                if (!isAuthenticated) {
                  console.log('Message received before authentication, ignoring')
                  return
                }

                // 确定目标 conversationId
                const targetConversationId = ws.selectedConversationId || message.data.conversationId
                if (!targetConversationId) {
                  const errorMsg = {
                    type: 'error',
                    data: {
                      message: 'No conversation selected. Please select a conversation first.',
                    },
                  }
                  ws.send(JSON.stringify(errorMsg))
                  return
                }

                // 移动端发送的消息 - 转发给桌面端处理
                // 桌面端会通过 ConversationPage 处理并同步历史
                // 这里只负责通知桌面端有新消息

                // 使用存储的项目路径
                if (!currentProjectPath) {
                  const errorMsg = {
                    type: 'response',
                    data: {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: '请先在桌面端选择项目文件夹',
                      timestamp: Date.now(),
                    },
                  }
                  ws.send(JSON.stringify(errorMsg))
                  return
                }

                // 调用 Claude
                try {
                  console.log('[WebSocket] Mobile message for conversation:', targetConversationId, message.data.content.substring(0, 50))

                  const response = await callClaude(targetConversationId, currentProjectPath, message.data.content)

                  // 生成唯一的消息ID（包含时间戳和随机数避免冲突）
                  const responseId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

                  // 发送响应给发起的客户端
                  ws.send(JSON.stringify({
                    type: 'response',
                    data: {
                      id: responseId,
                      role: 'assistant',
                      content: response,
                      timestamp: Date.now(),
                    },
                  }))
                } catch (error) {
                  const errorId = `assistant-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  const errorMsg = {
                    type: 'response',
                    data: {
                      id: errorId,
                      role: 'assistant',
                      content: error instanceof Error ? error.message : '调用 Claude 失败',
                      timestamp: Date.now(),
                    },
                  }
                  ws.send(JSON.stringify(errorMsg))
                }
              }
            } catch (error) {
              console.error('Failed to parse message:', error)
            }
          })

          // 处理关闭事件
          ws.on('close', () => {
            console.log('Mobile client disconnected')
            mobileClients.delete(ws)
          })

          // 处理错误事件
          ws.on('error', (error: Error) => {
            console.error('WebSocket error:', error)
          })
        }
      })

      console.log(`WebSocket server started on port ${PORT}`)
    }
  } catch (error) {
    console.error('Failed to start WebSocket server:', error)
  }
}

// 销毁 Claude 会话（当对话被删除时调用）
function destroyClaudeSession(conversationId: string): void {
  const session = claudeSessions.get(conversationId)
  if (!session) {
    console.log('[Claude] No session to destroy for conversation:', conversationId)
    return
  }

  console.log('[Claude] Destroying session for conversation:', conversationId, 'PID:', session.terminal.pid)

  try {
    // 终止 PTY 进程
    process.kill(session.terminal.pid, 'SIGTERM')

    // 清除超时定时器
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer)
    }
  } catch (error) {
    console.error('[Claude] Error destroying session:', error)
  }

  // 从映射表中移除
  claudeSessions.delete(conversationId)
  activeMessageId.delete(conversationId)
  conversationProjectMap.delete(conversationId)
}

// 获取或创建 Claude 会话（每个对话一个独立的 PTY 会话）
function getOrCreateClaudeSession(conversationId: string, projectPath: string): ClaudeSession {
  const session = claudeSessions.get(conversationId)

  // 检查现有会话是否还活着
  if (session) {
    try {
      process.kill(session.terminal.pid, 0)
      console.log('[Claude] Reusing existing session for conversation:', conversationId, 'PID:', session.terminal.pid, 'State:', session.state)
      return session
    } catch {
      console.log('[Claude] Existing session dead for conversation:', conversationId)
      claudeSessions.delete(conversationId)
      conversationProjectMap.delete(conversationId)
    }
  }

  // 创建新会话
  console.log('[Claude] Creating new session for conversation:', conversationId, 'Project:', projectPath)

  const terminal = spawnPty('claude', [], {
    name: 'xterm-color',
    cwd: projectPath,
    env: {
      ...process.env,
      CONVERSATION_ID: conversationId,
      CWD: projectPath,
    },
    cols: 100,
    rows: 30,
  })

  console.log('[Claude] PTY spawned with PID:', terminal.pid, 'for conversation:', conversationId)

  const newSession: ClaudeSession = {
    terminal,
    conversationId,
    projectPath,
    buffer: '',
    state: 'initializing',
    isInitialized: false,
    createdAt: Date.now(),
    hasReceivedRealContent: false,
    requestQueue: [],
    isProcessingQueue: false,
    lastSentContent: '',
    lastStatusLines: new Set<string>(),
    filterMode: 'develop',  // 默认使用 develop 模式
  }

  // 设置 PTY 数据处理器
  setupPTYDataHandler(newSession, conversationId)

  // PTY 退出处理
  terminal.onExit((e: { exitCode: number; signal?: number | undefined }) => {
    console.log('[Claude] PTY exited:', { exitCode: e.exitCode, signal: e.signal, conversationId })
    const currentMessageId = activeMessageId.get(conversationId)
    if (currentMessageId && mainWindow) {
      mainWindow.webContents.send('claude-stream', {
        conversationId,
        messageId: currentMessageId,
        type: 'done',
        content: '',
        timestamp: Date.now(),
      })
    }
    claudeSessions.delete(conversationId)
    activeMessageId.delete(conversationId)
    conversationProjectMap.delete(conversationId)
  })

  claudeSessions.set(conversationId, newSession)
  conversationProjectMap.set(conversationId, projectPath)

  // 新建 conversation 时广播给移动端
  scheduleBroadcastConversationList()

  // 发送初始化开始事件到前端
  if (mainWindow) {
    mainWindow.webContents.send('claude-status-change', {
      conversationId,
      status: 'initializing'
    })
    console.log('[Claude] Sent status-change event: initializing for conversation:', conversationId)
  }

  return newSession
}

/**
 * 设置 PTY 数据处理器（分离出来以便复用）
 */
function setupPTYDataHandler(session: ClaudeSession, conversationId: string): void {
  console.log('[Claude] Setting up PTY data handler for conversation:', conversationId)

  session.terminal.onData((data: string) => {
    const chunk = data
    const currentMessageId = activeMessageId.get(conversationId)

    // 调试日志 - 始终输出
    console.log('[Claude PTY Data]', {
      conversationId,
      state: session.state,
      hasMessageId: !!currentMessageId,
      chunkLen: chunk.length,
      bufLen: session.buffer.length,
      chunkPreview: chunk.slice(0, 50).replace(/\n/g, '\\n'),
    })

    // 添加到缓冲区
    session.buffer += chunk

    // 检测信任文件夹提示
    if (detectTrustPrompt(session.buffer)) {
      console.log('[Claude] Trust folder prompt detected for conversation:', conversationId)
      session.state = 'waiting_trust'
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer)
        session.timeoutTimer = undefined
      }
      if (mainWindow) {
        mainWindow.webContents.send('claude-trust-request', {
          conversationId,
          projectPath: session.projectPath,
          message: stripAnsiCodes(session.buffer),
        })
      }
      session.buffer = ''
      return
    }

    // 等待响应状态
    if (session.state === 'waiting_trust' || session.state === 'waiting_permission') {
      return
    }

    // 初始化阶段：检测欢迎信息和提示符来判断初始化完成
    if (session.state === 'initializing') {
      // 首先检查是否收到了欢迎信息
      const hasWelcome = hasWelcomeMessage(session.buffer)
      // 然后检查是否有提示符（使用宽松检测，因为欢迎界面包含大量UI元素）
      const hasPrompt = isPromptIndicator(session.buffer, true)

      // 调试日志：检测状态
      console.log('[Claude Init Check]', {
        conversationId,
        bufferLen: session.buffer.length,
        bufferPreview: session.buffer.slice(0, 100).replace(/\n/g, '\\n'),
        hasWelcome,
        hasPrompt,
      })

      if (hasWelcome && hasPrompt) {
        console.log('[Claude] Welcome message and prompt detected, initialization complete for conversation:', conversationId)
        console.log('[Claude] Buffer content:', session.buffer.slice(0, 300))
        session.state = 'ready'
        session.isInitialized = true
        session.initializedAt = Date.now()
        // 清空buffer，准备接收用户输入
        session.buffer = ''
        console.log('[Claude] Session is now ready for user input, conversationId:', conversationId)

        // ==================== Happy 架构改进 - 初始化完成 ====================
        sessionStateManager.setClaudeStatus(conversationId, 'ready')

        // session 状态变化时广播给移动端
        scheduleBroadcastConversationList()

        // 发送初始化完成事件到前端
        if (mainWindow) {
          mainWindow.webContents.send('claude-status-change', {
            conversationId,
            status: 'ready'
          })
          console.log('[Claude] Sent status-change event: ready for conversation:', conversationId)
        }
      } else if (hasPrompt) {
        // 只有提示符但没有欢迎信息，继续等待
        console.log('[Claude] Prompt detected but no welcome message yet, continuing to wait for conversation:', conversationId)
      } else {
        console.log('[Claude] Still initializing, waiting for welcome message and prompt for conversation:', conversationId)
      }
      return
    }

    // 没有活跃消息，不处理
    if (!currentMessageId) {
      return
    }

    // 权限请求检测
    if (session.state === 'processing') {
      const permissionCheck = detectPermissionPrompt(session.buffer)
      if (permissionCheck.hasPrompt) {
        console.log('[Claude] Permission prompt detected for conversation:', conversationId)
        session.state = 'waiting_permission'
        if (session.timeoutTimer) {
          clearTimeout(session.timeoutTimer)
          session.timeoutTimer = undefined
        }
        if (mainWindow) {
          mainWindow.webContents.send('claude-permission-request', {
            conversationId,
            projectPath: session.projectPath,
            toolName: permissionCheck.toolName || 'unknown',
            details: stripAnsiCodes(session.buffer),
          })
        }
        session.buffer = ''
        return
      }
    }

    // 处理并发送内容
    const cleanedChunk = stripAnsiCodes(chunk)

    // 调试：打印原始chunk
    console.log('[Claude Content Processing]', {
      conversationId,
      chunkLen: chunk.length,
      cleanedLen: cleanedChunk.length,
      chunkPreview: cleanedChunk.slice(0, 100).replace(/\n/g, '\\n'),
    })

    // 检查用户消息是否在输出中
    if (session.lastUserMessage) {
      const hasUserMessage = cleanedChunk.includes(session.lastUserMessage)
      console.log('[Claude Content Processing] User message in output:', hasUserMessage, 'Message:', JSON.stringify(session.lastUserMessage))
      if (hasUserMessage) {
        const idx = cleanedChunk.indexOf(session.lastUserMessage)
        console.log('[Claude Content Processing] User message found at index:', idx)
        console.log('[Claude Content Processing] Context around user message:', JSON.stringify(cleanedChunk.slice(Math.max(0, idx - 20), idx + session.lastUserMessage.length + 20)))
      }
    }

    // 过滤用户输入的 echo
    let contentToSend = cleanedChunk
    let hadEcho = false
    if (session.lastUserMessage && cleanedChunk.includes(session.lastUserMessage)) {
      hadEcho = true
      const idx = cleanedChunk.indexOf(session.lastUserMessage)
      let afterUserMsg = cleanedChunk.slice(idx + session.lastUserMessage.length)
      if (afterUserMsg.startsWith('\n')) afterUserMsg = afterUserMsg.slice(1)
      else if (afterUserMsg.startsWith('\r\n')) afterUserMsg = afterUserMsg.slice(2)
      contentToSend = afterUserMsg
      console.log('[Claude Content Processing] Filtered user echo, remaining:', JSON.stringify(contentToSend.slice(0, 100)))
      console.log('[Claude Content Processing] Remaining after echo (full):', JSON.stringify(contentToSend))
    }

    // 过滤终端UI元素（边框、横线等），并对状态行进行去重
    const { content: filteredContent, newStatusLines } = filterTerminalUI(contentToSend, session.lastStatusLines, session.filterMode)
    // 更新状态行集合（去重后保留的状态行）
    session.lastStatusLines = newStatusLines

    // 调试：打印过滤后的结果
    console.log('[Claude Content Processing]', {
      hadEcho,
      beforeFilterLen: contentToSend.length,
      afterFilterLen: filteredContent.length,
      filteredPreview: filteredContent.slice(0, 100).replace(/\n/g, '\\n'),
    })

    // 发送有效内容
    if (filteredContent.length > 0) {
      // 去重：检查是否与上次发送的内容相同
      if (session.lastSentContent === filteredContent) {
        console.log('[Claude Content Processing] ⚠ Duplicate content skipped, length:', filteredContent.length)
      } else {
        // 格式化内容以适配聊天气泡
        const formattedContent = formatForChatBubble(filteredContent)

        // 如果格式化后为空，跳过
        if (formattedContent.length === 0) {
          console.log('[Claude Content Processing] ⚠ Content became empty after formatting')
          return
        }

        // 标记已收到实际内容
        session.hasReceivedRealContent = true
        session.lastSentContent = formattedContent  // 存储格式化后的内容用于去重
        console.log('[Claude Content Processing] ✓ Sending content to frontend, length:', formattedContent.length)

        if (mainWindow) {
          mainWindow.webContents.send('claude-stream', {
            conversationId,
            messageId: currentMessageId,
            type: 'content',
            content: formattedContent,
            timestamp: Date.now(),
          })
        }
      }
    } else {
      console.log('[Claude Content Processing] ✗ No content to send after filtering (chunk was:', cleanedChunk.length > 0 ? 'not empty' : 'empty', ')')
    }

    // 检测响应完成（检测到提示符）- 只有在收到实际内容后才认为响应完成
    // 只检查 buffer 的最后部分（最近 500 个字符），避免旧内容影响检测
    const recentBuffer = session.buffer.length > 500 ? session.buffer.slice(-500) : session.buffer
    if (isPromptIndicator(recentBuffer)) {
      // 检查是否已收到实际内容（避免UI重绘导致的误判）
      if (!session.hasReceivedRealContent) {
        console.log('[Claude] Prompt detected but no real content received yet, continuing to wait for conversation:', conversationId)
        // 不清空buffer，继续等待
        return
      }

      console.log('[Claude] Response complete - prompt detected with real content for conversation:', conversationId)
      if (mainWindow) {
        mainWindow.webContents.send('claude-stream', {
          conversationId,
          messageId: currentMessageId,
          type: 'done',
          content: '',
          timestamp: Date.now(),
        })
      }
      session.buffer = ''
      session.state = 'ready'
      session.lastUserMessage = undefined
      session.hasReceivedRealContent = false  // 重置标志
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer)
        session.timeoutTimer = undefined
      }
      activeMessageId.delete(conversationId)

      // ==================== Happy 架构改进 - 响应完成，清除思考状态 ====================
      sessionStateManager.setThinking(conversationId, false)
      sessionStateManager.setClaudeStatus(conversationId, 'ready')

      // session 状态变化时广播给移动端
      scheduleBroadcastConversationList()

      // 处理队列中的下一个请求
      processRequestQueue(session, conversationId)
    }

    // 清空缓冲区
    session.buffer = ''
  })
}

/**
 * 处理请求队列（处理下一个等待的请求）
 */
function processRequestQueue(session: ClaudeSession, conversationId: string): void {
  // 如果队列为空或已经在处理，直接返回
  if (session.requestQueue.length === 0 || session.isProcessingQueue) {
    return
  }

  // 如果会话不在 ready 状态，不能处理下一个请求
  if (session.state !== 'ready') {
    console.log('[Claude Queue] Session not ready, queue will be processed later. State:', session.state)
    return
  }

  const nextRequest = session.requestQueue.shift()
  if (!nextRequest) {
    return
  }

  console.log('[Claude Queue] Processing next request from queue, remaining:', session.requestQueue.length)
  session.isProcessingQueue = true

  // 执行请求
  executeClaudeRequest(
    nextRequest.conversationId,
    nextRequest.projectPath,
    nextRequest.message
  ).then(nextRequest.resolve).catch(nextRequest.reject).finally(() => {
    session.isProcessingQueue = false
    // 递归处理下一个请求
    processRequestQueue(session, conversationId)
  })
}

/**
 * 实际执行 Claude 请求（不涉及队列管理）
 */
async function executeClaudeRequest(conversationId: string, projectPath: string, message: string, filterMode?: 'talk' | 'develop'): Promise<string> {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  console.log('[Claude] === executeClaudeRequest ===')
  console.log('[Claude] Conversation ID:', conversationId)
  console.log('[Claude] Project path:', projectPath)
  console.log('[Claude] Message:', message)
  console.log('[Claude] Generated messageId:', messageId)
  console.log('[Claude] Filter mode:', filterMode || 'develop')

  // ==================== Happy 架构改进 - 状态更新 ====================
  // 设置思考状态为 true
  sessionStateManager.setThinking(conversationId, true)
  // 设置 Claude 状态为 initializing
  sessionStateManager.setClaudeStatus(conversationId, 'initializing')

  // 获取或创建 PTY 会话（每个对话独立的会话）
  const session = getOrCreateClaudeSession(conversationId, projectPath)
  const { terminal } = session

  // 更新会话的过滤模式
  session.filterMode = filterMode || 'develop'

  console.log('[Claude] PTY PID:', terminal.pid, 'State:', session.state, 'Initialized:', session.isInitialized, 'FilterMode:', session.filterMode, 'Raw filterMode param:', filterMode)

  // 等待初始化完成
  if (!session.isInitialized) {
    console.log('[Claude] Waiting for initialization...')
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Initialization timeout'))
        }, 20000) // 20秒超时

        const checkInterval = setInterval(() => {
          if (session.isInitialized) {
            clearTimeout(timeout)
            clearInterval(checkInterval)
            resolve()
          }
        }, 200)
      })
      console.log('[Claude] Initialization complete')
      // 初始化完成，设置状态为 ready
      sessionStateManager.setClaudeStatus(conversationId, 'ready')
    } catch {
      console.error('[Claude] Initialization timeout, forcing ready state')
      // 超时后强制设置为已初始化
      session.isInitialized = true
      session.state = 'ready'

      // session 状态变化时广播给移动端
      scheduleBroadcastConversationList()

      // 超时也设置状态为 ready
      sessionStateManager.setClaudeStatus(conversationId, 'ready')
    }
  } else {
    // 已经初始化，设置状态为 ready
    sessionStateManager.setClaudeStatus(conversationId, 'ready')
  }

  // 设置会话状态和消息 ID
  session.state = 'processing'
  session.lastUserMessage = message
  session.buffer = ''
  session.hasReceivedRealContent = false  // 重置内容接收标志
  session.lastStatusLines.clear()  // 重置状态行集合（每个新响应重新开始去重）
  activeMessageId.set(conversationId, messageId)
  console.log('[Claude] Active message ID set:', messageId)

  // 发送消息到 PTY
  try {
    // 方法：先清除当前行，然后发送消息
    console.log('[Claude PTY Send] Starting message send sequence...')

    // 1. 发送 Ctrl+A (移动到行首) + Ctrl+K (清除到行尾)
    terminal.write('\x01') // Ctrl+A
    await new Promise(resolve => setTimeout(resolve, 30))
    terminal.write('\x0B') // Ctrl+K
    await new Promise(resolve => setTimeout(resolve, 30))

    // 2. 发送用户的消息（逐字符发送，模拟真实输入）
    for (const char of message) {
      terminal.write(char)
      await new Promise(resolve => setTimeout(resolve, 10)) // 每个字符间隔10ms
    }

    // 3. 发送回车执行命令
    terminal.write('\r')
    await new Promise(resolve => setTimeout(resolve, 50))

    console.log('[Claude PTY Send] Message sent to PTY:', JSON.stringify(message))
    console.log('[Claude PTY Send] Message bytes:', Buffer.from(message).toString('hex'))

    // 重置超时定时器
    resetTimeoutTimer(session, conversationId)
  } catch (error) {
    console.error('[Claude] Failed to send message:', error)
    session.state = 'ready'

    // ==================== Happy 架构改进 - 清除思考状态 ====================
    sessionStateManager.setThinking(conversationId, false)
    sessionStateManager.setClaudeStatus(conversationId, 'ready')

    // session 状态变化时广播给移动端
    scheduleBroadcastConversationList()

    throw error
  }

  return messageId
}

// 发送消息给 Claude（使用 PTY，带队列支持）
async function callClaude(conversationId: string, projectPath: string, message: string, filterMode?: 'talk' | 'develop'): Promise<string> {
  console.log('[Claude] === callClaude ===')
  console.log('[Claude] Conversation ID:', conversationId)
  console.log('[Claude] Message:', message)
  console.log('[Claude] Filter mode:', filterMode || 'develop')

  // 获取会话
  const session = claudeSessions.get(conversationId)
  if (!session) {
    // 如果会话不存在，直接执行请求（会创建新会话）
    return executeClaudeRequest(conversationId, projectPath, message, filterMode)
  }

  console.log('[Claude Queue] Current state:', session.state, 'Queue length:', session.requestQueue.length)

  // 如果会话正在处理消息，将请求加入队列
  if (session.state === 'processing' || session.isProcessingQueue) {
    console.log('[Claude Queue] Session busy, adding request to queue')

    return new Promise<string>((resolve, reject) => {
      session.requestQueue.push({
        conversationId,
        projectPath,
        message,
        resolve,
        reject,
      })
    })
  }

  // 否则直接执行请求
  return executeClaudeRequest(conversationId, projectPath, message, filterMode)
}

// 发送聊天历史给移动客户端
function sendChatHistory(ws: WebSocketClient) {
  try {
    // 深拷贝历史记录，避免引用问题
    const historyCopy = chatHistory.map(msg => ({ ...msg }))
    const message = JSON.stringify({
      type: 'history',
      data: historyCopy,
    })
    ws.send(message)
    console.log(`Sent chat history: ${historyCopy.length} messages`)
  } catch (error) {
    console.error('Failed to send chat history:', error)
  }
}

// 广播消息给所有移动客户端
interface BroadcastMessage {
  type: 'history' | 'message' | 'permission_request'
  data: ChatMessage[] | ChatMessage | PermissionRequest
}

// 权限相关类型定义
interface PermissionRequest {
  id: string
  type: string
  toolType: string
  title: string
  description: string
  resourcePath?: string
  command?: string
  details?: string[]
  createdAt: number
  status: string
  source: 'desktop' | 'mobile'
}

interface PermissionResponse {
  requestId: string
  choice: 'yes' | 'yesAlways' | 'no' | 'noAlways' | 'exit'
  timestamp: number
  source: 'desktop' | 'mobile'
}

interface PermissionRule {
  toolType: string
  pattern?: string
  allow: boolean
  createdAt: number
}

function broadcastToMobileClients(message: BroadcastMessage) {
  const messageStr = JSON.stringify(message)
  let sentCount = 0
  mobileClients.forEach((client) => {
    if (client.readyState === WS_READY_STATE_OPEN) { // WebSocket.OPEN
      try {
        client.send(messageStr)
        sentCount++
      } catch (error) {
        console.error('Failed to send message to mobile client:', error)
      }
    }
  })
  console.log(`Broadcast to ${sentCount} mobile clients:`, message.type)
}

// IPC 处理器：打开文件夹选择器
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const selectedPath = result.filePaths[0]
  currentProjectPath = selectedPath // 存储当前项目路径
  return selectedPath
})

// IPC 处理器：打开文件选择器
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Select File to Attach',
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code Files', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml'] },
    ],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// IPC 处理器：选择文件（用于文件附件功能）
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Code Files', extensions: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled) return { success: false }
  return { success: true, filePath: result.filePaths[0] }
})

// IPC 处理器：设置当前项目路径
ipcMain.handle('set-project-path', async (_event, projectPath: string) => {
  currentProjectPath = projectPath
  return { success: true }
})

// IPC 处理器：发送消息给 Claude Code（返回消息 ID）
ipcMain.handle('claude-send', async (_event, conversationId: string, projectPath: string, message: string, filterMode?: 'talk' | 'develop') => {
  const messageId = await callClaude(conversationId, projectPath, message, filterMode)
  return { messageId }
})

// IPC 处理器：获取 conversation 列表（用于移动端同步）
ipcMain.handle('get-conversation-list', async () => {
  try {
    const conversations = Array.from(claudeSessions.entries()).map(([convId, session]) => {
      // 确定状态
      let status: 'not_started' | 'initializing' | 'ready' = 'not_started'
      if (session.isInitialized) {
        status = session.state === 'ready' ? 'ready' : 'initializing'
      }

      return {
        id: convId,
        title: convId, // TODO: 后续可以从存储获取实际标题
        status,
        lastMessage: session.lastUserMessage || undefined,
        updatedAt: session.lastUserMessage ? Date.now() : 0
      }
    })

    console.log('[Conversation List] Sending', conversations.length, 'conversations')
    return { success: true, conversations }
  } catch (error) {
    console.error('[Conversation List] Error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// 处理文件内容
function handleFileContent(filePath: string): string {
  const fs = require('fs')
  const ext = filePath.split('.').pop()?.toLowerCase()
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown'

  try {
    // 代码文件：直接读取内容
    const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'go', 'rs', 'txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'css', 'html', 'vue', 'rb', 'php', 'swift', 'kt', 'scala', 'cs', 'vb']
    if (codeExtensions.includes(ext || '')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return `[文件: ${fileName}]\n\n\`\`\`${ext || 'text'}\n${content}\n\`\`\``
    }

    // 图片文件：转换为 base64
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
    if (imageExtensions.includes(ext || '')) {
      const buffer = fs.readFileSync(filePath)
      const base64 = buffer.toString('base64')
      return `[图片: ${fileName}]\n\`\`\`\ndata:image/${ext};base64,${base64}\n\`\`\``
    }

    // 其他文件：只发送文件路径
    return `[文件: ${filePath}]`
  } catch (error) {
    console.error('[File] Failed to read file:', error)
    return `[文件读取失败: ${fileName}]`
  }
}

// IPC 处理器：上传文件到对话
ipcMain.handle('upload-file', async (_event, filePath: string, conversationId: string) => {
  try {
    if (!currentProjectPath) {
      return { success: false, error: '请先选择项目文件夹' }
    }

    const content = handleFileContent(filePath)
    await callClaude(conversationId, currentProjectPath, content)

    console.log('[File] Uploaded file to conversation:', conversationId)
    return { success: true }
  } catch (error) {
    console.error('[File] Failed to upload file:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC 处理器：设置连接密码
ipcMain.handle('set-link-password', async (_event, password: string) => {
  linkPassword = password
  // 重启 WebSocket 服务器以应用新密码
  startWebSocketServer()
  return { success: true, port: PORT }
})

// IPC 处理器：获取连接信息
ipcMain.handle('get-connection-info', async () => {
  // 获取本机 IP 地址
  const os = await import('os')
  const interfaces = os.networkInterfaces()
  let localIP = '127.0.0.1'

  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name]
    if (networkInterface) {
      for (const iface of networkInterface) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address
          break
        }
      }
    }
  }

  return {
    ip: localIP,
    port: PORT,
    hasPassword: !!linkPassword,
  }
})

// IPC 处理器：更新聊天历史（由渲染进程调用）
ipcMain.handle('update-chat-history', async (_event, messages: ChatMessage[]) => {
  // 深拷贝避免引用问题
  chatHistory = messages.map(msg => ({ ...msg }))
  // 广播新的聊天历史给所有移动客户端
  broadcastToMobileClients({
    type: 'history',
    data: chatHistory,
  })
  return { success: true }
})

// IPC 处理器：添加单条消息到聊天历史
ipcMain.handle('add-chat-message', async (_event, message: ChatMessage) => {
  // 检查是否已存在相同 ID 的消息
  const exists = chatHistory.some(m => m.id === message.id)
  if (!exists) {
    // 深拷贝避免引用问题
    chatHistory.push({ ...message })
    // 广播新消息给所有移动客户端
    broadcastToMobileClients({
      type: 'message',
      data: { ...message },
    })
  } else {
    console.log(`Skipped duplicate message in chatHistory: ${message.id}`)
  }
  return { success: true }
})

// 权限规则存储（可以后续改为持久化存储）
const permissionRules: PermissionRule[] = []

// IPC 处理器：请求权限
ipcMain.handle('request-permission', async (event, request: PermissionRequest): Promise<PermissionResponse> => {
  console.log('Permission request:', request)

  // 检查是否有匹配的权限规则
  for (const rule of permissionRules) {
    if (rule.toolType === request.toolType) {
      // 如果有规则但没有模式，或者模式匹配
      if (!rule.pattern || matchPattern(request, rule.pattern)) {
        console.log(`Permission ${rule.allow ? 'granted' : 'denied'} by rule:`, rule)
        return {
          requestId: request.id,
          choice: rule.allow ? 'yes' : 'no',
          timestamp: Date.now(),
          source: 'desktop',
        }
      }
    }
  }

  // 如果没有匹配规则，返回特殊标记表示需要用户确认
  // 渲染进程需要处理这个情况并显示弹窗
  if (mainWindow) {
    // 向渲染进程发送权限请求事件
    mainWindow.webContents.send('permission-request', request)
  }

  // 返回一个挂起状态，渲染进程需要通过另一个 IPC 调用返回用户选择
  return {
    requestId: request.id,
    choice: 'no', // 默认拒绝，等待用户确认
    timestamp: Date.now(),
    source: 'desktop',
  }
})

// IPC 处理器：获取权限规则列表
ipcMain.handle('get-permission-rules', async () => {
  return permissionRules
})

// IPC 处理器：添加权限规则
ipcMain.handle('add-permission-rule', async (_event, rule: PermissionRule) => {
  console.log('Adding permission rule:', rule)
  permissionRules.push(rule)
  return { success: true }
})

// IPC 处理器：清除权限规则
ipcMain.handle('clear-permission-rules', async () => {
  permissionRules.length = 0
  console.log('All permission rules cleared')
  return { success: true }
})

// IPC 处理器：响应信任文件夹请求
ipcMain.handle('respond-trust', async (_event, conversationId: string, trust: boolean) => {
  console.log('=== Trust Response Start ===')
  console.log('Conversation ID:', conversationId)
  console.log('Trust choice:', trust)

  const session = claudeSessions.get(conversationId)
  if (!session) {
    console.log('No Claude session found for conversation:', conversationId)
    return { success: false, error: 'Session not found' }
  }

  console.log('Current state before trust response:', session.state)
  console.log('Buffer length before trust response:', session.buffer.length)
  console.log('Buffer content preview:', JSON.stringify(session.buffer.slice(0, 200)))

  try {
    // 输入 1 然后按回车来确认信任，或者输入 Ctrl+C 退出
    const response = trust ? '1\n' : '\x03'
    console.log('Writing to PTY:', JSON.stringify(response))

    // 清空buffer中的trust prompt内容
    session.buffer = ''
    // 重置已发送内容长度（信任响应后会有新输出）
    // lastSentBufferLength removed

    // 写入trust响应
    session.terminal.write(response)
    console.log('Trust response written to PTY')

    // 恢复processing状态
    session.state = 'processing'

    // 等待一段时间后检查是否有PTY输出，如果没有则重新发送用户消息
    const userMessage = session.lastUserMessage
    if (userMessage) {
      console.log('Will check for PTY output and resend message if needed:', userMessage)
      const checkInterval = setInterval(() => {
        // 如果收到PTY数据，取消定时器
        if (session.buffer.length > 0) {
          console.log('PTY output detected, canceling message resend')
          clearInterval(checkInterval)
          return
        }
      }, 500)

      // 2秒后检查，如果没有输出则重新发送用户消息
      setTimeout(() => {
        clearInterval(checkInterval)
        console.log('>>> 2 second check - Buffer length:', session.buffer.length)
        console.log('>>> Last user message:', session.lastUserMessage)

        if (session.buffer.length === 0 && session.lastUserMessage === userMessage) {
          console.log('>>> No PTY output after 2 seconds, resending user message')
          console.log('>>> Resending:', userMessage)

          // 检查PTY进程是否还在运行
          try {
            process.kill(session.terminal.pid, 0)
            console.log('>>> PTY process is running, preparing to send message')

            // 先发送Ctrl+U清除可能的输入缓冲区，然后发送消息
            console.log('>>> Sending Ctrl+U to clear input buffer')
            session.terminal.write('\x15') // Ctrl+U

            setTimeout(() => {
              console.log('>>> Sending user message')
              session.terminal.write(userMessage + '\n')
              console.log('>>> Message resent to PTY')
            }, 100)

            // 5秒后再次检查是否有响应
            setTimeout(() => {
              console.log('>>> 5 second post-resend check - Buffer length:', session.buffer.length)
              if (session.buffer.length > 0) {
                console.log('>>> PTY responded after resend!')
                console.log('>>> Response preview:', session.buffer.slice(0, 200))
              } else {
                console.log('>>> PTY still not responding after resend')
              }
            }, 6000)
          } catch {
            console.log('>>> PTY process is NOT running!')
          }
        } else if (session.buffer.length > 0) {
          console.log('>>> PTY has output, not resending message')
          console.log('>>> Output:', session.buffer.slice(0, 100))
        }
      }, 2000)
    }

    // 重置超时定时器，给PTY更多时间响应
    resetTimeoutTimer(session, conversationId)

    console.log('State changed to: processing')
    console.log('Timeout timer reset')
    console.log('=== Trust Response Complete ===')
    return { success: true }
  } catch (error) {
    console.error('Failed to write trust response to PTY:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC 处理器：响应权限请求（将用户选择发送回 Claude PTY）
ipcMain.handle('respond-permission', async (_event, conversationId: string, choice: string) => {
  console.log('Permission response:', conversationId, choice)

  const session = claudeSessions.get(conversationId)
  if (!session) {
    console.log('No Claude session found for conversation:', conversationId)
    return { success: false, error: 'Session not found' }
  }

  // 将用户选择转换为 Claude 期望的输入
  let responseInput = ''
  switch (choice) {
    case 'yes':
      responseInput = 'y\n'
      break
    case 'yesAlways':
      responseInput = 'ya\n'
      break
    case 'no':
      responseInput = 'n\n'
      break
    case 'noAlways':
      responseInput = 'na\n'
      break
    case 'exit':
      responseInput = 'exit\n'
      break
    default:
      responseInput = 'n\n'
  }

  try {
    session.terminal.write(responseInput)
    session.state = 'processing'
    session.buffer = '' // 清空缓冲区，准备接收新的输出
    // 重置已发送内容长度（权限响应后会有新输出）
    // lastSentBufferLength removed
    // 不要清空 lastUserMessage，因为可能还在处理同一轮对话
    console.log('Sent permission response to Claude PTY:', responseInput.trim())
    return { success: true }
  } catch (error) {
    console.error('Failed to write permission response to PTY:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC 处理器：清理对话会话（当对话被删除时调用）
ipcMain.handle('cleanup-conversation', async (_event, conversationId: string) => {
  console.log('[Claude] Cleanup request for conversation:', conversationId)
  destroyClaudeSession(conversationId)

  // 删除 conversation 时广播给移动端
  scheduleBroadcastConversationList()

  return { success: true }
})

// IPC 处理器：初始化 Claude 会话（新建对话时主动创建 PTY）
ipcMain.handle('initialize-claude', async (_event, conversationId: string, projectPath: string) => {
  console.log('[Claude] Initialize request for conversation:', conversationId, 'Project:', projectPath)

  try {
    // 直接调用 getOrCreateClaudeSession 来创建 PTY 会话
    const session = getOrCreateClaudeSession(conversationId, projectPath)
    console.log('[Claude] Session initialized for conversation:', conversationId, 'PID:', session.terminal.pid)

    // 新建 conversation 时广播给移动端
    scheduleBroadcastConversationList()

    return { success: true }
  } catch (error) {
    console.error('[Claude] Failed to initialize session:', error)
    return { success: false, error: (error as Error).message }
  }
})

// IPC 处理器：读取目录结构
ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  const fs = await import('fs')
  const path = await import('path')

  interface FileNode {
    name: string
    path: string
    type: 'file' | 'folder'
    children?: FileNode[]
  }

  function buildDirectoryTree(currentPath: string, basePath: string = currentPath): FileNode[] {
    const nodes: FileNode[] = []

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        // 跳过隐藏文件和 node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue
        }

        const fullPath = path.join(currentPath, entry.name)
        const relativePath = path.relative(basePath, fullPath)

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'folder',
            children: buildDirectoryTree(fullPath, basePath),
          })
        } else if (entry.isFile()) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          })
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error)
    }

    return nodes
  }

  try {
    const tree = buildDirectoryTree(dirPath)
    return { success: true, tree }
  } catch (error) {
    console.error('Error building directory tree:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：读取 Claude Code 配置
ipcMain.handle('read-claude-config', async () => {
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs')

  try {
    const homeDir = os.homedir()
    const configPath = path.join(homeDir, '.config', 'claude', 'config.json')

    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'Config file not found' }
    }

    const configContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent)

    // 解析模型列表
    const models: ModelInfo[] = []
    if (config.models) {
      for (const [id, modelConfig] of Object.entries(config.models)) {
        const model = modelConfig as Record<string, unknown>
        models.push({
          id,
          name: (model.displayName || model.model || id) as string,
          provider: (model.provider || 'Anthropic') as string,
          version: (model.version || '1.0') as string,
        })
      }
    }

    return {
      success: true,
      config: {
        models,
        currentModel: config.defaultModel || models[0]?.id,
        apiKey: config.apiKey,
        provider: config.provider,
      },
    }
  } catch (error) {
    console.error('Error reading Claude config:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

interface ModelInfo {
  id: string
  name: string
  provider: string
  version: string
}

// IPC 处理器：获取 API 用量
ipcMain.handle('get-api-usage', async () => {
  try {
    // 尝试调用 claude usage 命令
    const { execSync } = await import('child_process')

    const usageData = {
      requestsUsed: 0,
      requestsLimit: 100,
      tokensUsed: 0,
      tokensLimit: 5000000,
      resetTime: Date.now() + 5 * 60 * 60 * 1000,
    }

    try {
      // 调用 claude usage 命令
      const output = execSync('claude usage', {
        encoding: 'utf-8',
        timeout: 10000, // 10秒超时
      })

      console.log('Claude usage output:', output)

      // 尝试解析输出
      // Claude Code 的 usage 命令输出格式可能如下：
      // "Requests: 45/100 (45%)
      //  Tokens: 1234567/5000000 (24.6%)
      //  Reset: 2024-01-15 12:00:00"

      const requestsMatch = output.match(/Requests?:\s*(\d+)\/(\d+)/)
      const tokensMatch = output.match(/Tokens?:\s*(\d+)\/(\d+)/)
      const resetMatch = output.match(/Reset?:\s*([^\n]+)/)

      if (requestsMatch) {
        usageData.requestsUsed = parseInt(requestsMatch[1], 10)
        usageData.requestsLimit = parseInt(requestsMatch[2], 10)
      }

      if (tokensMatch) {
        usageData.tokensUsed = parseInt(tokensMatch[1], 10)
        usageData.tokensLimit = parseInt(tokensMatch[2], 10)
      }

      if (resetMatch) {
        const resetDate = new Date(resetMatch[1].trim())
        if (!isNaN(resetDate.getTime())) {
          usageData.resetTime = resetDate.getTime()
        }
      }

      return {
        success: true,
        usage: usageData,
      }
    } catch (execError) {
      // 如果 claude usage 命令失败，使用模拟数据
      console.warn('Failed to get real usage data, using mock data:', execError)

      // 模拟智谱 GLM 的 5 小时用量限制
      usageData.requestsUsed = Math.floor(Math.random() * 100)

      // 模拟 MCP 每月用量
      usageData.tokensUsed = Math.floor(Math.random() * 5000000)

      return {
        success: true,
        usage: usageData,
        mock: true, // 标记为模拟数据
      }
    }
  } catch (error) {
    console.error('Error getting API usage:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：获取已安装的 Skills
ipcMain.handle('get-skills', async () => {
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs')

  try {
    const homeDir = os.homedir()
    const skillsDir = path.join(homeDir, '.config', 'claude', 'skills')

    if (!fs.existsSync(skillsDir)) {
      return { success: true, skills: [] }
    }

    const skills: Array<{ name: string; path: string; description?: string }> = []

    // 读取 skills 目录
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name)
        const skillJsonPath = path.join(skillPath, 'skill.json')

        let description: string | undefined

        // 尝试读取 skill.json
        if (fs.existsSync(skillJsonPath)) {
          try {
            const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'))
            description = skillJson.description
          } catch {
            // 忽略解析错误
          }
        }

        skills.push({
          name: entry.name,
          path: skillPath,
          description,
        })
      }
    }

    return { success: true, skills }
  } catch (error) {
    console.error('Error getting skills:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：获取 MCP 服务器配置
ipcMain.handle('get-mcp-servers', async () => {
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs')

  try {
    const homeDir = os.homedir()
    const mcpConfigPath = path.join(homeDir, '.config', 'claude', 'mcp.json')

    if (!fs.existsSync(mcpConfigPath)) {
      return { success: true, servers: [] }
    }

    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'))
    const servers: Array<{ name: string; command: string; args?: string[] }> = []

    // 解析 MCP 服务器配置
    if (mcpConfig.mcpServers) {
      for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
        const serverConfig = config as Record<string, unknown>
        servers.push({
          name,
          command: (serverConfig.command as string) || '',
          args: serverConfig.args as string[] | undefined,
        })
      }
    }

    return { success: true, servers }
  } catch (error) {
    console.error('Error getting MCP servers:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：切换模型
ipcMain.handle('switch-model', async (_event, modelId: string) => {
  const os = await import('os')
  const path = await import('path')
  const fs = await import('fs')

  try {
    const homeDir = os.homedir()
    const configPath = path.join(homeDir, '.config', 'claude', 'config.json')

    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'Config file not found' }
    }

    // 读取当前配置
    const configContent = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent)

    // 更新默认模型
    config.defaultModel = modelId

    // 写回配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    console.log('Model switched to:', modelId)

    return { success: true, modelId }
  } catch (error) {
    console.error('Error switching model:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：获取 Git 状态
ipcMain.handle('get-git-status', async (_event, projectPath: string) => {
  const { execSync } = await import('child_process')

  try {
    // 检查是否是 Git 仓库
    try {
      execSync('git rev-parse --git-dir', {
        cwd: projectPath,
        stdio: 'ignore',
      })
    } catch {
      return { success: false, error: 'Not a git repository' }
    }

    // 获取当前分支
    let currentBranch = ''
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        encoding: 'utf-8',
      }).trim()
    } catch {
      currentBranch = 'main'
    }

    // 获取所有分支
    let branches: string[] = []
    try {
      const branchOutput = execSync('git branch -a', {
        cwd: projectPath,
        encoding: 'utf-8',
      })
      branches = branchOutput
        .split('\n')
        .map(line => line.trim().replace(/^\*?\s*/, ''))
        .filter(line => line.length > 0)
    } catch {
      branches = [currentBranch]
    }

    // 获取状态
    let status = ''
    try {
      status = execSync('git status --short', {
        cwd: projectPath,
        encoding: 'utf-8',
      }).trim()
    } catch {
      status = ''
    }

    // 获取最近提交
    let commits: Array<{ hash: string; message: string; author: string; date: string }> = []
    try {
      const logOutput = execSync('git log -10 --pretty=format:"%H|%s|%an|%ad" --date=short', {
        cwd: projectPath,
        encoding: 'utf-8',
      })
      commits = logOutput
        .split('\n')
        .filter(line => line.includes('|'))
        .map(line => {
          const [hash, message, author, date] = line.split('|')
          return { hash: hash.substring(0, 8), message, author, date }
        })
    } catch {
      commits = []
    }

    return {
      success: true,
      git: {
        currentBranch,
        branches,
        status,
        commits,
      },
    }
  } catch (error) {
    console.error('Error getting git status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// IPC 处理器：搜索文件内容
ipcMain.handle('search-files', async (_event, projectPath: string, query: string) => {
  const { execSync } = await import('child_process')

  try {
    // 首先尝试使用 ripgrep (rg)，如果不可用则使用 grep
    let results: Array<{ file: string; line: number; content: string }> = []

    try {
      // 使用 ripgrep 进行搜索
      const rgOutput = execSync(`rg "${query}" --json --no-ignore`, {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 30000, // 30秒超时
      })

      const lines = rgOutput.split('\n').filter(line => line.trim().length > 0)
      results = lines
        .map(line => {
          try {
            const data = JSON.parse(line)
            if (data.type === 'match' && data.data) {
              return {
                file: data.data.path.text || '',
                line: data.data.line_number || 0,
                content: data.data.lines.text || '',
              }
            }
            return null
          } catch {
            return null
          }
        })
        .filter((item): item is { file: string; line: number; content: string } => item !== null)
        .slice(0, 100) // 限制结果数量
    } catch {
      // ripgrep 不可用，尝试使用 grep
      try {
        const grepOutput = execSync(`grep -r -n "${query}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.py" --include="*.java" --include="*.go" --include="*.rs" --include="*.cpp" --include="*.c" --include="*.h" .`, {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: 30000,
        })

        results = grepOutput
          .split('\n')
          .filter(line => line.includes(':'))
          .map(line => {
            const parts = line.split(':')
            if (parts.length >= 3) {
              const filePath = parts[0]
              const lineNumber = parseInt(parts[1], 10)
              const content = parts.slice(2).join(':').trim()
              return {
                file: filePath,
                line: lineNumber,
                content,
              }
            }
            return null
          })
          .filter((item): item is { file: string; line: number; content: string } => item !== null)
          .slice(0, 100)
      } catch (grepError) {
        console.warn('Both ripgrep and grep failed:', grepError)
        return { success: false, error: 'Search tool not available (ripgrep or grep required)' }
      }
    }

    return {
      success: true,
      results,
    }
  } catch (error) {
    console.error('Error searching files:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// 简单的模式匹配函数
function matchPattern(request: PermissionRequest, pattern: string): boolean {
  // 简单的通配符匹配
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')

  // 检查资源路径
  if (request.resourcePath && regex.test(request.resourcePath)) {
    return true
  }

  // 检查命令
  if (request.command && regex.test(request.command)) {
    return true
  }

  return false
}

// ==================== 项目本地存储 ====================

/**
 * 获取项目的缓存目录路径
 */
function getProjectCacheDir(projectPath: string): string {
  return path.join(projectPath, '.claudephone')
}

/**
 * 获取项目的对话记录文件路径
 */
function getProjectConversationsFile(projectPath: string): string {
  return path.join(getProjectCacheDir(projectPath), 'conversations.json')
}

/**
 * 确保项目缓存目录存在
 */
function ensureProjectCacheDir(projectPath: string): void {
  const cacheDir = getProjectCacheDir(projectPath)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
}

/**
 * 读取项目的对话记录
 */
ipcMain.handle('read-project-conversations', async (_event, projectPath: string) => {
  try {
    ensureProjectCacheDir(projectPath)
    const filePath = getProjectConversationsFile(projectPath)

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const conversations = JSON.parse(content)
      return { success: true, conversations }
    }

    return { success: true, conversations: [] }
  } catch (error) {
    console.error('Failed to read project conversations:', error)
    return { success: false, error: (error as Error).message }
  }
})

/**
 * 保存项目的对话记录
 */
ipcMain.handle('save-project-conversations', async (_event, projectPath: string, conversations: unknown[]) => {
  try {
    ensureProjectCacheDir(projectPath)
    const filePath = getProjectConversationsFile(projectPath)
    fs.writeFileSync(filePath, JSON.stringify(conversations, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Failed to save project conversations:', error)
    return { success: false, error: (error as Error).message }
  }
})

/**
 * 删除项目的对话记录
 */
ipcMain.handle('delete-project-conversation', async (_event, projectPath: string, conversationId: string) => {
  try {
    const filePath = getProjectConversationsFile(projectPath)

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const conversations = JSON.parse(content)
      const filtered = conversations.filter((c: { id: string }) => c.id !== conversationId)
      fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8')
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to delete project conversation:', error)
    return { success: false, error: (error as Error).message }
  }
})

// ==================== 操作日志 IPC ====================

// 订阅实时日志
ipcMain.on('subscribe-to-logs', (event) => {
  console.log('[IPC] Client subscribed to logs')

  let unsubscribed = false
  const unsubscribe = operationLogger.subscribe((log) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('log-entry', log)
    }
  })

  const cleanup = () => {
    if (!unsubscribed) {
      unsubscribed = true
      unsubscribe()
      console.log('[IPC] Client unsubscribed from logs')
    }
  }

  event.sender.once('destroyed', cleanup)
  event.sender.once('disconnect', cleanup)
})

// 获取历史日志
ipcMain.handle('get-logs', async (_event, filter?: LogFilter) => {
  console.log('[IPC] get-logs called, filter:', filter)
  try {
    if (filter) {
      return operationLogger.getFilteredLogs(filter)
    }
    return operationLogger.getAllLogs()
  } catch (error) {
    console.error('[IPC] get-logs error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// 清空日志
ipcMain.handle('clear-logs', async () => {
  console.log('[IPC] clear-logs called')
  try {
    operationLogger.clear()
    return { success: true }
  } catch (error) {
    console.error('[IPC] clear-logs error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// 导出日志
ipcMain.handle('export-logs', async (_event, format: 'json' | 'text' = 'json') => {
  console.log('[IPC] export-logs called, format:', format)
  try {
    return operationLogger.export(format)
  } catch (error) {
    console.error('[IPC] export-logs error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// ==================== 检查点管理 IPC ====================

// 列出所有检查点
ipcMain.handle('checkpoint-list', async () => {
  try {
    const checkpoints = checkpointManager.list()
    // 转换 Map 为普通对象以便序列化
    return checkpoints.map(cp => ({
      ...cp,
      fileSnapshots: Array.from(cp.fileSnapshots.entries())
    }))
  } catch (error) {
    console.error('[Checkpoint] List error:', error)
    return []
  }
})

// 获取单个检查点
ipcMain.handle('checkpoint-get', async (_event, id: string) => {
  try {
    const checkpoint = checkpointManager.get(id)
    if (!checkpoint) return null
    return {
      ...checkpoint,
      fileSnapshots: Array.from(checkpoint.fileSnapshots.entries())
    }
  } catch (error) {
    console.error('[Checkpoint] Get error:', error)
    return null
  }
})

// 手动创建检查点
ipcMain.handle('checkpoint-create', async (_event, name: string, description: string) => {
  try {
    const checkpoint = checkpointManager.createManual(name, description, new Map())
    return {
      ...checkpoint,
      fileSnapshots: Array.from(checkpoint.fileSnapshots.entries())
    }
  } catch (error) {
    console.error('[Checkpoint] Create error:', error)
    return null
  }
})

// ==================== 回滚操作 IPC ====================

// 预览回滚
ipcMain.handle('rollback-preview', async (_event, checkpointId: string) => {
  try {
    const preview = rollbackEngine.previewRollback(checkpointId)
    return preview
  } catch (error) {
    console.error('[Rollback] Preview error:', error)
    return { files: [], canRollback: false, warnings: ['Preview failed'] }
  }
})

// 执行回滚
ipcMain.handle('rollback-execute', async (_event, checkpointId: string) => {
  try {
    const result = await rollbackEngine.rollbackTo(checkpointId)

    // 记录回滚操作
    operationLogger.logSystem(
      `Rollback to checkpoint ${checkpointId}: ${result.files?.length || 0} files affected`,
      result.success ? 'success' : 'error'
    )

    return result
  } catch (error) {
    console.error('[Rollback] Execute error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// ==================== 日志导出 IPC (v2) ====================

// 导出日志（新版本，支持 CSV 和 Markdown）
ipcMain.handle('export-logs-v2', async (_event, options: { format: 'json' | 'csv' | 'markdown', timeRange?: { start: number; end: number } }) => {
  try {
    const logs = operationLogger.getLogs()
    const exporter = new LogExporter()
    const content = exporter.export(logs, options)
    return content
  } catch (error) {
    console.error('[Export] Error:', error)
    throw error
  }
})

// ==================== 审批引擎 IPC ====================

// 订阅审批请求
ipcMain.on('subscribe-to-approvals', (event) => {
  console.log('[IPC] Client subscribed to approvals')

  const unsubscribe = approvalEngine.onApprovalRequest((request) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('approval-request', request)
    }
  })

  const cleanup = () => {
    unsubscribe()
    console.log('[IPC] Client unsubscribed from approvals')
  }

  event.sender.once('destroyed', cleanup)
  event.sender.once('disconnect', cleanup)
})

// 处理用户审批响应
ipcMain.on('approval-response', (event, data) => {
  console.log('[IPC] approval-response:', data)
  approvalEngine.handleUserResponse(
    data.requestId,
    data.choice,
    data.remember
  )
})

// 获取用户偏好
ipcMain.handle('get-approval-preferences', async () => {
  return approvalEngine.getPreferences()
})

// 更新用户偏好
ipcMain.handle('update-approval-preferences', async (_event, preferences) => {
  try {
    approvalEngine.updatePreferences(preferences)
    return { success: true }
  } catch (error) {
    console.error('[IPC] update-approval-preferences error:', error)
    return { success: false, error: (error as Error).message }
  }
})

// 清除记住的选择
ipcMain.handle('clear-remembered-choices', async () => {
  try {
    approvalEngine.clearRememberedChoices()
    return { success: true }
  } catch (error) {
    console.error('[IPC] clear-remembered-choices error:', error)
    return { success: false, error: (error as Error).message }
  }
})

app.on('ready', async () => {
  createWindow()
  startWebSocketServer()

  // 启动 MCP 代理服务器
  const MCP_PROXY_PORT = 3010
  try {
    // 初始化 CheckpointManager
    checkpointManager = new CheckpointManager(50, 7)

    // 初始化 OperationExecutor（传入 CheckpointManager）
    const operationExecutor = new OperationExecutor(
      (tool: string) => approvalEngine.getToolConfig(tool),
      checkpointManager
    )

    // 初始化 RollbackEngine（传入 CheckpointManager 和 OperationExecutor）
    rollbackEngine = new RollbackEngine(
      checkpointManager,
      operationExecutor
    )

    const mcpProxyServer = new MCPProxyServer(
      MCP_PROXY_PORT,
      approvalEngine,
      operationLogger,
      operationExecutor
    )
    await mcpProxyServer.start()
    console.log('[Main] MCP Proxy Server started successfully')

    // 存储到全局以便后续使用
    ;(global as any).mcpProxyServer = mcpProxyServer
  } catch (error) {
    console.error('[Main] Failed to start MCP Proxy Server:', error)
  }
  // Initialize browser manager
  try {
    await getBrowserManager().initialize()
    console.log('[Main] Browser manager initialized')
  } catch (error) {
    console.error('[Main] Failed to initialize browser manager:', error)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// 应用退出时关闭 WebSocket 服务器
app.on('before-quit', async () => {
  if (wss && typeof wss.close === 'function') {
    wss.close()
  }

  // 停止 MCP 代理服务器
  if ((global as any).mcpProxyServer) {
    await (global as any).mcpProxyServer.stop()
  }
  // Close browser manager before quitting
  try {
    await getBrowserManager().close()
    console.log('[Main] Browser manager closed')
  } catch (error) {
    console.error('[Main] Failed to close browser manager:', error)
  }
})
