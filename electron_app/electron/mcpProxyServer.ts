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
import type { OperationLogger } from './operationLogger.js'
import type { OperationExecutor } from './operationExecutor.js'

const require = createRequire(import.meta.url)
const express = require('express')

export class MCPProxyServer extends EventEmitter {
  private server: Server | null = null
  private httpServer: any | null = null
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

        // 执行工具（暂时返回模拟结果）
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
      // 浏览器工具
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL in controlled browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to navigate to (must be in whitelist)'
            }
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
            selector: {
              type: 'string',
              description: 'CSS selector'
            }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_screenshot',
        description: 'Take screenshot of current page',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
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
   * 执行工具（暂时返回模拟结果）
   */
  private async executeTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text: string }>
    metadata?: Record<string, unknown>
    isError?: boolean
  }> {
    // TODO: Phase 3 实现实际执行逻辑
    switch (name) {
      case 'browser_navigate':
        return {
          content: [{
            type: 'text',
            text: `Navigation to ${args.url as string} initiated (not yet implemented)`
          }]
        }

      case 'browser_click':
        return {
          content: [{
            type: 'text',
            text: `Click on ${args.selector as string} initiated (not yet implemented)`
          }]
        }

      case 'browser_screenshot':
        return {
          content: [{
            type: 'text',
            text: 'Screenshot captured (not yet implemented)'
          }],
          metadata: {
            screenshot: 'base64-screenshot-data-placeholder'
          }
        }

      case 'sandbox_read_file':
        return {
          content: [{
            type: 'text',
            text: `File content from ${args.path as string} (not yet implemented)`
          }]
        }

      case 'sandbox_write_file':
        return {
          content: [{
            type: 'text',
            text: `Wrote ${(args.content as string)?.length || 0} bytes to ${args.path as string} (not yet implemented)`
          }]
        }

      case 'system_exec':
        return {
          content: [{
            type: 'text',
            text: `Executed: ${args.command as string} (not yet implemented)`
          }]
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
