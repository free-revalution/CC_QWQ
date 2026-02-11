# Phase 3: Execution Ability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现文件读取、系统命令执行和文件写入回滚的执行能力

**Architecture:** 创建独立的 OperationExecutor 类，通过沙盒验证后执行实际操作，使用 approvalEngine 的权限配置

**Tech Stack:** Node.js fs, child_process, TypeScript, MCP SDK

---

## Task 1: Create OperationExecutor Class

**Files:**
- Create: `electron/operationExecutor.ts`

**Step 1: Write the file skeleton**

```typescript
/**
 * Operation Executor - 操作执行器
 *
 * 执行实际的文件和命令操作，带沙盒限制和快照支持
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import type { ToolPermissionConfig } from '../src/types/operation.js'

// 文件快照存储
interface FileSnapshot {
  id: string
  type: 'file'
  filePath: string
  content: string | null
  hash: string
  timestamp: number
  size: number
}

// 执行结果
interface ExecutionResult {
  success: boolean
  data?: any
  error?: string
  snapshotId?: string
}

export class OperationExecutor {
  private snapshots: Map<string, FileSnapshot> = new Map()

  constructor(
    private getToolPermission: (tool: string) => ToolPermissionConfig | undefined
  ) {}

  /**
   * 读取文件（沙盒限制）
   */
  async readFile(filePath: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 执行系统命令
   */
  async executeCommand(command: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 写入文件（支持回滚）
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 回滚文件到指定快照
   */
  async rollback(snapshotId: string): Promise<ExecutionResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 验证路径是否在沙盒允许范围内
   */
  private validatePath(filePath: string, allowedPaths: string[]): boolean {
    // 实现将在后续步骤完成
    return false
  }

  /**
   * 创建文件快照
   */
  private async createSnapshot(filePath: string): Promise<FileSnapshot> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }
}
```

**Step 2: Run TypeScript check to verify skeleton compiles**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors for operationExecutor

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: add OperationExecutor class skeleton"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 2: Implement Path Validation

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Add glob matching utilities and validatePath method**

Add after the imports section:

```typescript
// 简单的 glob 匹配实现
function matchesPattern(value: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(regex).test(value)
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.startsWith('!')) {
      const regex = pattern.substring(1).replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      return !new RegExp(regex).test(value)
    }
    return matchesPattern(value, pattern)
  })
}
```

Replace the validatePath placeholder with:

```typescript
  /**
   * 验证路径是否在沙盒允许范围内
   */
  private validatePath(filePath: string, allowedPaths: string[]): boolean {
    // 规范化路径
    const normalizedPath = path.normalize(filePath)

    // 检查是否匹配任何允许的模式
    return matchesAnyPattern(normalizedPath, allowedPaths)
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: add path validation with glob matching"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 3: Implement File Read

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Replace readFile placeholder with implementation**

Replace the readFile method with:

```typescript
  /**
   * 读取文件（沙盒限制）
   */
  async readFile(filePath: string): Promise<ExecutionResult> {
    try {
      // 获取权限配置
      const permission = this.getToolPermission('sandbox_read_file')

      if (!permission?.sandboxConstraints?.allowedPaths) {
        return { success: false, error: 'No sandbox constraints configured for file reading' }
      }

      // 验证路径
      if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths)) {
        return { success: false, error: `Access denied: path not in allowed sandbox` }
      }

      // 读取文件
      const content = await fs.readFile(filePath, 'utf-8')

      return {
        success: true,
        data: { content }
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` }
      } else if (err.code === 'EACCES') {
        return { success: false, error: `Permission denied: ${filePath}` }
      }
      return { success: false, error: `Failed to read file: ${err.message}` }
    }
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: implement file read with sandbox validation"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 4: Implement Command Execution

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Add executeCommand implementation**

Replace the executeCommand placeholder with:

```typescript
  /**
   * 执行系统命令
   */
  async executeCommand(command: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      try {
        // 获取权限配置
        const permission = this.getToolPermission('system_exec')

        if (!permission) {
          resolve({ success: false, error: 'Command execution not configured' })
          return
        }

        // 简单的命令注入检查
        const dangerousChars = [';', '|', '&', '`', '$', '(', ')', '\n', '\r']
        const hasDangerousChar = dangerousChars.some(char => command.includes(char))

        if (hasDangerousChar) {
          resolve({ success: false, error: 'Command contains dangerous characters' })
          return
        }

        // 解析命令
        const parts = command.trim().split(/\s+/)
        const cmd = parts[0]
        const args = parts.slice(1)

        // 执行命令
        const proc = spawn(cmd, args, {
          cwd: process.cwd(),
          env: { ...process.env, PATH: process.env.PATH }
        })

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (data) => {
          stdout += data.toString()
        })

        proc.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        // 超时控制（60秒）
        const timeout = setTimeout(() => {
          proc.kill()
          resolve({
            success: false,
            error: 'Command timed out after 60 seconds'
          })
        }, 60000)

        proc.on('close', (code) => {
          clearTimeout(timeout)
          resolve({
            success: code === 0,
            data: {
              exitCode: code,
              stdout: stdout.trim(),
              stderr: stderr.trim()
            }
          })
        })

        proc.on('error', (error) => {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: `Failed to execute command: ${error.message}`
          })
        })
      } catch (error) {
        resolve({
          success: false,
          error: `Command execution error: ${(error as Error).message}`
        })
      }
    })
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: implement command execution with timeout"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 5: Implement Snapshot Creation

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Add createSnapshot method implementation**

Replace the createSnapshot placeholder with:

```typescript
  /**
   * 创建文件快照
   */
  private async createSnapshot(filePath: string): Promise<FileSnapshot> {
    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const timestamp = Date.now()

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const hash = createHash('sha256').update(content).digest('hex')

      const snapshot: FileSnapshot = {
        id: snapshotId,
        type: 'file',
        filePath,
        content,
        hash,
        timestamp,
        size: content.length
      }

      return snapshot
    } catch (error) {
      // 文件不存在或无法读取
      const snapshot: FileSnapshot = {
        id: snapshotId,
        type: 'file',
        filePath,
        content: null,
        hash: '',
        timestamp,
        size: 0
      }

      return snapshot
    }
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: implement snapshot creation for files"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 6: Implement File Write with Snapshot

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Add writeFile implementation**

Replace the writeFile placeholder with:

```typescript
  /**
   * 写入文件（支持回滚）
   */
  async writeFile(filePath: string, content: string): Promise<ExecutionResult> {
    try {
      // 获取权限配置
      const permission = this.getToolPermission('sandbox_write_file')

      if (!permission?.sandboxConstraints) {
        return { success: false, error: 'No sandbox constraints configured for file writing' }
      }

      // 验证路径
      if (!this.validatePath(filePath, permission.sandboxConstraints.allowedPaths)) {
        return { success: false, error: `Access denied: path not in allowed sandbox` }
      }

      // 检查文件大小限制
      const maxSize = permission.sandboxConstraints.maxFileSize || 10 * 1024 * 1024
      if (content.length > maxSize) {
        return {
          success: false,
          error: `File too large: ${content.length} bytes (max: ${maxSize} bytes)`
        }
      }

      // 创建快照
      const snapshot = await this.createSnapshot(filePath)

      // 写入文件
      await fs.writeFile(filePath, content, 'utf-8')

      // 存储快照
      this.snapshots.set(snapshot.id, snapshot)

      return {
        success: true,
        data: {
          bytesWritten: content.length,
          snapshotId: snapshot.id
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: implement file write with snapshot support"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 7: Implement Rollback

**Files:**
- Modify: `electron/operationExecutor.ts`

**Step 1: Add rollback method**

Replace the rollback placeholder with:

```typescript
  /**
   * 回滚文件到指定快照
   */
  async rollback(snapshotId: string): Promise<ExecutionResult> {
    const snapshot = this.snapshots.get(snapshotId)

    if (!snapshot) {
      return {
        success: false,
        error: `Snapshot not found: ${snapshotId}`
      }
    }

    try {
      if (snapshot.content === null) {
        // 文件原本不存在，删除它
        await fs.unlink(snapshot.filePath)
      } else {
        // 恢复文件内容
        await fs.writeFile(snapshot.filePath, snapshot.content, 'utf-8')
      }

      // 从内存中移除快照
      this.snapshots.delete(snapshotId)

      return {
        success: true,
        data: {
          rolledBackTo: snapshotId,
          filePath: snapshot.filePath
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 operationExecutor || echo "No errors for operationExecutor"`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/operationExecutor.ts
git commit -m "feat: implement file rollback from snapshots"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 8: Add Rollback Tool to MCP Proxy

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Import OperationExecutor**

Add at the top with other imports:

```typescript
import type { OperationExecutor } from './operationExecutor.js'
```

**Step 2: Add OperationExecutor to class**

Add to constructor parameters and class properties:

```typescript
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
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 mcpProxyServer || echo "No errors for mcpProxyServer"`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: add OperationExecutor to MCPProxyServer"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 9: Wire Up File Read in executeTool

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Update executeTool to call OperationExecutor for sandbox_read_file**

Replace the `case 'sandbox_read_file':` block with:

```typescript
      case 'sandbox_read_file':
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
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 3: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: wire up file read execution in MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 10: Wire Up Command Execution in executeTool

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Update executeTool for system_exec**

Replace the `case 'system_exec':` block with:

```typescript
      case 'system_exec':
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
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 3: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: wire up command execution in MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 11: Wire Up File Write in executeTool

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Update executeTool for sandbox_write_file**

Replace the `case 'sandbox_write_file':` block with:

```typescript
      case 'sandbox_write_file':
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
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 3: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: wire up file write with snapshot in MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 12: Add Rollback Tool Definition

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add sandbox_rollback to getAvailableTools**

Add after the sandbox_write_file tool definition (around line 273):

```typescript
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
      }
```

**Step 2: Add executeTool case for sandbox_rollback**

Add in executeTool method after the system_exec case:

```typescript
      case 'sandbox_rollback':
        const rollbackResult = await this.operationExecutor.rollback(args.snapshotId as string)
        if (rollbackResult.success) {
          const data = rollbackResult.data
          return {
            content: [{
              type: 'text',
              text: `Successfully rolled back to snapshot ${args.snapshotId}\nFile: ${data.filePath}`
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
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 4: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: add rollback tool to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 13: Instantiate OperationExecutor in main.ts

**Files:**
- Modify: `electron/main.ts`

**Step 1: Import OperationExecutor**

Add after the operationLogger import:

```typescript
import { OperationExecutor } from './operationExecutor.js'
```

**Step 2: Instantiate OperationExecutor before MCPProxyServer**

Find the MCPProxyServer instantiation and add OperationExecutor before it:

```typescript
// 操作执行器
export const operationExecutor = new OperationExecutor(
  (tool: string) => approvalEngine.getToolConfig(tool)
)
```

**Step 3: Pass OperationExecutor to MCPProxyServer**

Update the MCPProxyServer instantiation to include operationExecutor:

```typescript
        const mcpProxyServer = new MCPProxyServer(
          MCP_PROXY_PORT,
          approvalEngine,
          operationLogger,
          operationExecutor
        )
```

**Step 4: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 5: Commit**

```bash
git add electron/main.ts
git commit -m "feat: instantiate and wire up OperationExecutor"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 14: Add getToolConfig Method to ApprovalEngine

**Files:**
- Modify: `electron/approvalEngine.ts`

**Step 1: Add getToolConfig method**

Add before the closing brace of the ApprovalEngine class:

```typescript
  /**
   * 获取工具配置
   * @param tool 工具名称
   * @returns 工具权限配置
   */
  getToolConfig(tool: string): ToolPermissionConfig | undefined {
    return this.toolPermissions.get(tool)
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`
Expected: No errors

**Step 3: Commit**

```bash
git add electron/approvalEngine.ts
git commit -m "feat: add getToolConfig method to ApprovalEngine"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>

Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 15: Final Build and Verification

**Files:**
- All modified files

**Step 1: Run full build**

Run: `npm run build`
Expected: Build completes successfully with no TypeScript errors

**Step 2: Verify OperationExecutor exports**

Run: `grep -n "export class OperationExecutor" electron/operationExecutor.ts`
Expected: Shows the export line

**Step 3: Verify all tool definitions in MCPProxyServer**

Run: `grep -E "(sandbox_read_file|sandbox_write_file|system_exec|sandbox_rollback)" electron/mcpProxyServer.ts | grep "name:"`
Expected: Shows all 4 tool names

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 3 execution ability implementation

- Created OperationExecutor with sandbox validation
- Implemented file read, command execution, file write with rollback
- Integrated all tools with MCP proxy
- Added getToolConfig to ApprovalEngine

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```
