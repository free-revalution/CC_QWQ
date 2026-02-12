/**
 * MCP Proxy Server - MCP 代理服务器
 *
 * 通过 SSE 协议与 Claude Code 通信，代理工具调用请求
 */

import { EventEmitter } from 'events'
import { createRequire } from 'module'
import type { Request, Response } from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { MCPToolDefinition, SSEConnectionInfo } from '../src/types/operation.js'
import type { ApprovalEngine } from './approvalEngine.js'
import type { OperationLogger } from './operationLogger'
import type { OperationExecutor } from './operationExecutor.js'
import type { Server as HttpServer } from 'http'
import { getBrowserManager } from './browserManager.js'

const require = createRequire(import.meta.url)
const express = require('express')

export class MCPProxyServer extends EventEmitter {
  private server: Server | null = null
  private httpServer: HttpServer | null = null
  private port: number
  private approvalEngine: ApprovalEngine
  private operationLogger: OperationLogger
  private operationExecutor: OperationExecutor

  constructor(
    port: number,
    approvalEngine: ApprovalEngine,
    operationLogger: OperationLogger,
    operationExecutor: OperationExecutor
  ) {
    super()
    this.port = port
    this.approvalEngine = approvalEngine
    this.operationLogger = operationLogger
    this.operationExecutor = operationExecutor
  }

  /**
   * 启动 MCP 代理服务器
   */
  async start(): Promise<void> {
    console.log(`[MCP Proxy] Starting on port ${this.port}...`)

    // 创建 Express 应用
    const app = express()

    // SSE 端点
    app.get('/mcp', async (req: Request, res: Response) => {
      console.log('[MCP Proxy] New SSE connection from Claude Code')

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      // 创建 SSE 传输层
      const transport = new SSEServerTransport('/message', res)

      // 创建或获取 MCP 服务器实例
      if (!this.server) {
        this.server = new Server(
          {
            name: 'claudephone-mcp-proxy',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          }
        )

        this.setupHandlers()
      }

      try {
        // 连接传输层
        await this.server.connect(transport)
        console.log('[MCP Proxy] Client connected successfully')

        this.emit('client-connected')
      } catch (error) {
        console.error('[MCP Proxy] Failed to connect client:', error)
        res.end()
      }
    })

    // 消息端点（SSE 数据传输）
    app.use('/message', express.json())

    // 健康检查端点
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        port: this.port,
        timestamp: Date.now()
      })
    })

    // 启动 HTTP 服务器
    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(this.port, () => {
        console.log(`[MCP Proxy] HTTP server listening on port ${this.port}`)
        this.operationLogger.logSystem(
          `MCP Proxy Server started on http://localhost:${this.port}/mcp`,
          'success'
        )
        resolve()
      })

      this.httpServer.on('error', (error: Error) => {
        console.error('[MCP Proxy] HTTP server error:', error)
        reject(error)
      })
    })
  }

  /**
   * 设置 MCP 请求处理器
   */
  private setupHandlers(): void {
    if (!this.server) return

    // 列出可用工具
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => {
        console.log('[MCP Proxy] ListTools request')
        return {
          tools: this.getAvailableTools()
        }
      }
    )

    // 处理工具调用
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params
        console.log(`[MCP Proxy] Tool call: ${name}`, args)

        // 记录工具调用开始
        this.operationLogger.logToolStart(name, args || {})

        // 审批检查
        const decision = await this.approvalEngine.evaluate({
          tool: name,
          params: args || {},
          source: 'claude-code'
        })

        if (!decision.approved) {
          this.operationLogger.logApprovalDenied(name, decision.reason)
          return {
            content: [{
              type: 'text',
              text: `Tool call denied: ${decision.reason}`
            }],
            isError: false
          }
        }

        // 记录批准
        this.operationLogger.logApprovalGranted(name, decision.autoApproved)

        // 执行工具
        try {
          const startTime = Date.now()
          const result = await this.executeTool(name, args || {})
          const duration = Date.now() - startTime

          // 记录成功
          this.operationLogger.logToolSuccess(name, result, duration)

          return result
        } catch (error) {
          // 记录失败
          this.operationLogger.logToolError(name, error as Error)

          return {
            content: [{
              type: 'text',
              text: `Tool execution failed: ${(error as Error).message}`
            }],
            isError: true
          }
        }
      }
    )
  }

  /**
   * 获取可用工具列表
   */
  private getAvailableTools(): MCPToolDefinition[] {
    return [
      // Browser tools
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL in controlled browser',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            url: { type: 'string', description: 'URL to navigate to' }
          },
          required: ['url']
        }
      },
      {
        name: 'browser_click',
        description: 'Click an element on current page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector' }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_fill',
        description: 'Fill an input field with text',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector' },
            value: { type: 'string', description: 'Text to fill' }
          },
          required: ['selector', 'value']
        }
      },
      {
        name: 'browser_screenshot',
        description: 'Take screenshot of current page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' }
          },
          required: []
        }
      },
      {
        name: 'browser_text',
        description: 'Get text content from element',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector' }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_wait',
        description: 'Wait for element to appear',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_evaluate',
        description: 'Execute JavaScript in browser context',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            script: { type: 'string', description: 'JavaScript code to execute' }
          },
          required: ['script']
        }
      },
      {
        name: 'browser_cookies',
        description: 'Get browser cookies',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            action: { type: 'string', enum: ['get', 'set'], description: 'Action to perform' },
            cookie: {
              type: 'object',
              description: 'Cookie data (for set action)',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                domain: { type: 'string' },
                path: { type: 'string' },
                expiry: { type: 'number' }
              },
              required: ['name', 'value']
            }
          },
          required: ['action']
        }
      },
      {
        name: 'browser_upload',
        description: 'Upload file from allowed paths',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector of file input' },
            filePath: { type: 'string', description: 'Path to file to upload' }
          },
          required: ['selector', 'filePath']
        }
      },
      {
        name: 'browser_download',
        description: 'Download file by clicking element',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: main)' },
            selector: { type: 'string', description: 'CSS selector of download link/button' }
          },
          required: ['selector']
        }
      },

      // 文件工具
      {
        name: 'sandbox_read_file',
        description: 'Read a file from the allowed sandbox directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path within sandbox'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'sandbox_write_file',
        description: 'Write content to a file in the sandbox',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path within sandbox'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'sandbox_rollback',
        description: 'Roll back a file to a previous snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            snapshotId: {
              type: 'string',
              description: 'Snapshot ID to rollback to'
            }
          },
          required: ['snapshotId']
        }
      },

      // 系统工具
      {
        name: 'system_exec',
        description: 'Execute a command in the project directory',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute'
            },
            description: {
              type: 'string',
              description: 'What this command does'
            }
          },
          required: ['command', 'description']
        }
      }
    ]
  }

  /**
   * Execute tool and return result
   */
  private async executeTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text: string }>
    metadata?: Record<string, unknown>
    isError?: boolean
  }> {
    switch (name) {
      case 'browser_navigate': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().goto(pageId, args.url as string)
        return this.mcpResult(result)
      }

      case 'browser_click': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().click(pageId, args.selector as string)
        return this.mcpResult(result)
      }

      case 'browser_fill': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().fill(pageId, args.selector as string, args.value as string)
        return this.mcpResult(result)
      }

      case 'browser_screenshot': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().screenshot(pageId)
        return this.mcpResult(result)
      }

      case 'browser_text': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().getText(pageId, args.selector as string)
        return this.mcpResult(result)
      }

      case 'browser_wait': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().waitFor(pageId, args.selector as string, args.timeout as number | undefined)
        return this.mcpResult(result)
      }

      case 'browser_evaluate': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().evaluate(pageId, args.script as string)
        return this.mcpResult(result)
      }

      case 'browser_cookies': {
        const pageId = (args.pageId as string) || 'main'
        const action = args.action as string
        if (action === 'get') {
          const result = await getBrowserManager().getCookies(pageId)
          return this.mcpResult(result)
        } else if (action === 'set') {
          const result = await getBrowserManager().setCookie(pageId, args.cookie as unknown)
          return this.mcpResult(result)
        }
        break
      }

      case 'browser_upload': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().upload(pageId, args.selector as string, args.filePath as string)
        return this.mcpResult(result)
      }

      case 'browser_download': {
        const pageId = (args.pageId as string) || 'main'
        const result = await getBrowserManager().download(pageId, args.selector as string)
        return this.mcpResult(result)
      }

      case 'sandbox_read_file': {
        const readResult = await this.operationExecutor.readFile(args.path as string)
        if (readResult.success) {
          return {
            content: [{
              type: 'text',
              text: readResult.data.content
            }]
          }
        } else {
          return {
            content: [{
              type: 'text',
              text: readResult.error || 'Failed to read file'
            }],
            isError: true
          }
        }
      }

      case 'sandbox_write_file': {
        const writeResult = await this.operationExecutor.writeFile(
          args.path as string,
          args.content as string
        )
        if (writeResult.success) {
          const data = writeResult.data
          return {
            content: [{
              type: 'text',
              text: `Successfully wrote ${data.bytesWritten} bytes to ${args.path as string}\nSnapshot ID: ${data.snapshotId}`
            }]
          }
        } else {
          return {
            content: [{
              type: 'text',
              text: writeResult.error || 'Failed to write file'
            }],
            isError: true
          }
        }
      }

      case 'system_exec': {
        const execResult = await this.operationExecutor.executeCommand(args.command as string)
        if (execResult.success) {
          const data = execResult.data
          let output = `Exit code: ${data.exitCode}\n`
          if (data.stdout) output += `Output:\n${data.stdout}\n`
          if (data.stderr) output += `Errors:\n${data.stderr}`
          return {
            content: [{
              type: 'text',
              text: output.trim()
            }]
          }
        } else {
          return {
            content: [{
              type: 'text',
              text: execResult.error || 'Failed to execute command'
            }],
            isError: true
          }
        }
      }

      case 'sandbox_rollback': {
        const rollbackResult = await this.operationExecutor.rollback(args.snapshotId as string)
        if (rollbackResult.success) {
          const data = rollbackResult.data
          return {
            content: [{
              type: 'text',
              text: `Successfully rolled back to snapshot ${args.snapshotId as string}\nFile: ${data.filePath}`
            }]
          }
        } else {
          return {
            content: [{
              type: 'text',
              text: rollbackResult.error || 'Failed to rollback'
            }],
            isError: true
          }
        }
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`
          }],
          isError: true
        }
    }
  }

  /**
   * Convert BrowserResult to MCP response format
   */
  private mcpResult(result: { success: boolean; data?: unknown; error?: string }): {
    content: Array<{ type: string; text: string }>
    isError?: boolean
  } {
    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: result.data !== undefined ? JSON.stringify(result.data) : 'Operation completed successfully'
        }]
      }
    } else {
      return {
        content: [{
          type: 'text',
          text: result.error || 'Operation failed'
        }],
        isError: true
      }
    }
  }

  /**
   * 获取连接信息
   */
  getConnectionInfo(): SSEConnectionInfo {
    return {
      port: this.port,
      endpoint: `http://localhost:${this.port}/mcp`,
      healthEndpoint: `http://localhost:${this.port}/health`
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    console.log('[MCP Proxy] Stopping server...')

    if (this.server) {
      await this.server.close()
      this.server = null
    }

    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log('[MCP Proxy] Server stopped')
          resolve()
        })
      })
    }
  }
}
