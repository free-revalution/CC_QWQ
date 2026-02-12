# Phase 4: Browser Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 集成 Playwright 实现浏览器自动化能力，让 Claude Code 能够直接操作浏览器

**Architecture:** 创建 BrowserManager 单例类管理 Playwright 浏览器实例，通过 MCP 暴露工具给 Claude Code，操作经过 ApprovalEngine 审批，日志记录到 OperationLogger

**Tech Stack:** Playwright (Node.js), TypeScript, MCP SDK, Electron IPC

---

## Task 1: Install Playwright Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install Playwright**

Run: `npm install playwright`

Expected: Playwright and its dependencies installed

**Step 2: Install browser binaries**

Run: `npx playwright install chromium`

Expected: Chromium browser downloaded

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Playwright dependency for browser automation"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 2: Create BrowserManager Class Skeleton

**Files:**
- Create: `electron/browserManager.ts`

**Step 1: Write the file skeleton**

```typescript
/**
 * BrowserManager - 浏览器管理器
 *
 * 使用 Playwright 管理浏览器实例的生命周期和页面操作
 */

import { chromium, Browser, BrowserContext, Page, LaunchOptions } from 'playwright'

// 页面选项
export interface PageOptions {
  id?: string
  viewport?: { width: number; height: number }
}

// 操作结果
export interface BrowserResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * 浏览器管理器（单例）
 */
export class BrowserManager {
  private static instance: BrowserManager | null = null
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages: Map<string, Page> = new Map()

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager()
    }
    return BrowserManager.instance
  }

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }

  /**
   * 创建新页面
   */
  async newPage(options?: PageOptions): Promise<string> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }

  /**
   * 获取页面
   */
  async getPage(pageId: string): Promise<Page> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }

  /**
   * 关闭页面
   */
  async closePage(pageId: string): Promise<void> {
    // 实现将在后续步骤完成
    throw new Error('Not implemented')
  }

  /**
   * 导航到 URL
   */
  async goto(pageId: string, url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 点击元素
   */
  async click(pageId: string, selector: string, timeout?: number): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 填写表单
   */
  async fill(pageId: string, selector: string, value: string): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 截图
   */
  async screenshot(pageId: string, fullPage?: boolean): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 提取文本
   */
  async getText(pageId: string, selector?: string): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 等待元素
   */
  async waitFor(pageId: string, selector: string, timeout?: number): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 执行 JavaScript
   */
  async evaluate(pageId: string, script: string): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 上传文件
   */
  async upload(pageId: string, selector: string, filePath: string): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 下载文件
   */
  async download(pageId: string, selector: string, savePath: string): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 获取/设置 Cookie
   */
  async cookies(pageId: string, action: 'get' | 'set' | 'getAll', cookie?: any): Promise<BrowserResult> {
    // 实现将在后续步骤完成
    return { success: false, error: 'Not implemented' }
  }

  /**
   * 检查浏览器是否已初始化
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null
  }
}

/**
 * 导出单例访问函数
 */
export const getBrowserManager = (): BrowserManager => {
  return BrowserManager.getInstance()
}
```

**Step 2: Run TypeScript check**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors for browserManager

**Step 3: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: add BrowserManager class skeleton"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 3: Implement Browser Initialization

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement initialize method**

Replace the `initialize` placeholder with:

```typescript
  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized()) {
      return
    }

    const userDataDir = `${process.env.HOME}/.claude-browser`

    const launchOptions: LaunchOptions = {
      headless: false,
      channel: 'chrome',  // 使用系统安装的 Chrome
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ]
    }

    this.browser = await chromium.launch(launchOptions)

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Claude Code Browser Automation (https://claude.com/claude-code)',
      acceptDownloads: true,
    })

    // 创建默认页面
    const defaultPage = await this.context.newPage()
    const pageId = 'main'
    this.pages.set(pageId, defaultPage)
  }
```

**Step 2: Implement close method**

Replace the `close` placeholder with:

```typescript
  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close()
      this.context = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    this.pages.clear()
  }
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement browser initialization and cleanup"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 4: Implement Page Management

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement newPage method**

Replace the `newPage` placeholder with:

```typescript
  /**
   * 创建新页面
   */
  async newPage(options: PageOptions = {}): Promise<string> {
    if (!this.context) {
      throw new Error('Browser not initialized')
    }

    const page = await this.context.newPage()

    if (options.viewport) {
      await page.setViewportSize(options.viewport)
    }

    const pageId = options.id || `page-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    this.pages.set(pageId, page)

    return pageId
  }
```

**Step 2: Implement getPage method**

Replace the `getPage` placeholder with:

```typescript
  /**
   * 获取页面
   */
  async getPage(pageId: string): Promise<Page> {
    const page = this.pages.get(pageId)
    if (!page) {
      throw new Error(`Page not found: ${pageId}`)
    }
    return page
  }
```

**Step 3: Implement closePage method**

Replace the `closePage` placeholder with:

```typescript
  /**
   * 关闭页面
   */
  async closePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId)
    if (page) {
      await page.close()
      this.pages.delete(pageId)
    }
  }
```

**Step 4: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement page management methods"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 5: Implement Navigation Methods

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement goto method**

Replace the `goto` placeholder with:

```typescript
  /**
   * 导航到 URL
   */
  async goto(pageId: string, url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'load'): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      const response = await page.goto(url, {
        waitUntil,
        timeout: 30000
      })

      return {
        success: true,
        data: {
          url: page.url(),
          status: response?.status()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Navigation failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Implement screenshot method**

Replace the `screenshot` placeholder with:

```typescript
  /**
   * 截图
   */
  async screenshot(pageId: string, fullPage = false): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      const screenshot = await page.screenshot({
        fullPage,
        type: 'png'
      })

      // 转换为 base64
      const base64 = screenshot.toString('base64')

      return {
        success: true,
        data: {
          format: 'png',
          base64,
          size: screenshot.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement navigation and screenshot methods"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 6: Implement Basic Interaction Methods

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement click method**

Replace the `click` placeholder with:

```typescript
  /**
   * 点击元素
   */
  async click(pageId: string, selector: string, timeout = 30000): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      await page.click(selector, { timeout })

      return {
        success: true,
        data: {
          selector,
          action: 'clicked'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Click failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Implement fill method**

Replace the `fill` placeholder with:

```typescript
  /**
   * 填写表单
   */
  async fill(pageId: string, selector: string, value: string): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      await page.fill(selector, value)

      return {
        success: true,
        data: {
          selector,
          value
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Fill failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 3: Implement getText method**

Replace the `getText` placeholder with:

```typescript
  /**
   * 提取文本
   */
  async getText(pageId: string, selector?: string): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      let text: string

      if (selector) {
        const element = await page.locator(selector)
        text = await element.textContent() || ''
      } else {
        text = await page.textContent() || ''
      }

      return {
        success: true,
        data: {
          text,
          selector
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Get text failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 4: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement basic interaction methods"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 7: Implement Advanced Methods

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement waitFor method**

Replace the `waitFor` placeholder with:

```typescript
  /**
   * 等待元素
   */
  async waitFor(pageId: string, selector: string, timeout = 30000): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      await page.waitForSelector(selector, { timeout })

      return {
        success: true,
        data: {
          selector,
          action: 'waited'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Wait failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Implement evaluate method**

Replace the `evaluate` placeholder with:

```typescript
  /**
   * 执行 JavaScript
   */
  async evaluate(pageId: string, script: string): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      const result = await page.evaluate(script)

      return {
        success: true,
        data: {
          result
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Evaluate failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement advanced interaction methods"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 8: Implement Cookie Method

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement cookies method**

Replace the `cookies` placeholder with:

```typescript
  /**
   * 获取/设置 Cookie
   */
  async cookies(pageId: string, action: 'get' | 'set' | 'getAll', cookie?: any): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      if (action === 'get') {
        if (!cookie) {
          return { success: false, error: 'Cookie name is required for get action' }
        }
        const cookies = await page.context().cookies()
        const found = cookies.find(c => c.name === cookie.name)
        return {
          success: true,
          data: { cookie: found || null }
        }
      } else if (action === 'set') {
        await page.context().addCookies([cookie])
        return {
          success: true,
          data: { action: 'set', cookie }
        }
      } else if (action === 'getAll') {
        const cookies = await page.context().cookies()
        return {
          success: true,
          data: { cookies }
        }
      }

      return { success: false, error: 'Invalid action' }
    } catch (error) {
      return {
        success: false,
        error: `Cookies operation failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement cookie management method"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 9: Implement File Upload/Download Methods

**Files:**
- Modify: `electron/browserManager.ts`

**Step 1: Implement upload method**

Replace the `upload` placeholder with:

```typescript
  /**
   * 上传文件
   */
  async upload(pageId: string, selector: string, filePath: string): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      const fileInput = await page.locator(selector)
      await fileInput.setInputFiles(filePath)

      return {
        success: true,
        data: {
          selector,
          filePath
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Upload failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 2: Implement download method**

Replace the `download` placeholder with:

```typescript
  /**
   * 下载文件
   */
  async download(pageId: string, selector: string, savePath: string): Promise<BrowserResult> {
    try {
      const page = await this.getPage(pageId)

      // 设置下载处理
      const downloadPromise = page.waitForEvent('download')

      // 点击触发下载的元素
      await page.click(selector)

      // 等待下载开始
      const download = await downloadPromise

      // 保存文件
      await download.saveAs(savePath)

      return {
        success: true,
        data: {
          savePath,
          filename: download.suggestedFilename()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Download failed: ${(error as Error).message}`
      }
    }
  }
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 browserManager || echo "No errors for browserManager"`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add electron/browserManager.ts
git commit -m "feat: implement file upload and download methods"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 10: Wire Up BrowserManager in main.ts

**Files:**
- Modify: `electron/main.ts`

**Step 1: Import BrowserManager**

Add after the OperationExecutor import:

```typescript
import { getBrowserManager } from './browserManager.js'
```

**Step 2: Initialize browser on app ready**

Find the `app.whenReady()` section and add browser initialization after the window creation:

```typescript
      // 初始化浏览器管理器
      try {
        await getBrowserManager().initialize()
        console.log('Browser manager initialized')
      } catch (error) {
        console.error('Failed to initialize browser manager:', error)
      }
```

**Step 3: Close browser on app quit**

Add before `app.on('quit')`:

```typescript
// 关闭浏览器
app.on('before-quit', async () => {
  try {
    await getBrowserManager().close()
  } catch (error) {
    console.error('Failed to close browser manager:', error)
  }
})
```

**Step 4: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`

Expected: No errors

**Step 5: Commit**

```bash
git add electron/main.ts
git commit -m "feat: initialize browser manager on app startup"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 11: Add Browser Tool Permissions to ApprovalEngine

**Files:**
- Modify: `electron/approvalEngine.ts`

**Step 1: Add browser tool permissions**

Add to the `toolPermissions` Map in the constructor (after existing tools):

```typescript
    // 浏览器自动化工具

    // 基础导航 - 低风险
    ['browser_navigate', {
      tool: 'browser_navigate',
      requiresApproval: false,
      riskLevel: 'low',
      sandboxConstraints: {
        allowedUrls: [
          'https://**',
          'http://localhost/**'
        ]
      }
    }],

    // 截图 - 低风险
    ['browser_screenshot', {
      tool: 'browser_screenshot',
      requiresApproval: false,
      riskLevel: 'low'
    }],

    // 文本提取 - 低风险
    ['browser_text', {
      tool: 'browser_text',
      requiresApproval: false,
      riskLevel: 'low'
    }],

    // 点击元素 - 中风险
    ['browser_click', {
      tool: 'browser_click',
      requiresApproval: true,
      riskLevel: 'medium',
      autoApprovePatterns: []
    }],

    // 填写表单 - 中风险
    ['browser_fill', {
      tool: 'browser_fill',
      requiresApproval: true,
      riskLevel: 'medium',
      autoApprovePatterns: []
    }],

    // 等待 - 低风险
    ['browser_wait', {
      tool: 'browser_wait',
      requiresApproval: false,
      riskLevel: 'low'
    }],

    // 执行 JavaScript - 高风险
    ['browser_evaluate', {
      tool: 'browser_evaluate',
      requiresApproval: true,
      riskLevel: 'high',
      autoApprovePatterns: []
    }],

    // Cookie 操作 - 高风险
    ['browser_cookies', {
      tool: 'browser_cookies',
      requiresApproval: true,
      riskLevel: 'high',
      autoApprovePatterns: []
    }],

    // 文件上传 - 高风险
    ['browser_upload', {
      tool: 'browser_upload',
      requiresApproval: true,
      riskLevel: 'high',
      sandboxConstraints: {
        allowedPaths: [
          process.env.HOME + '/**',
          '!**/.env',
          '!**/secrets/**'
        ]
      }
    }],

    // 文件下载 - 高风险
    ['browser_download', {
      tool: 'browser_download',
      requiresApproval: true,
      riskLevel: 'high',
      sandboxConstraints: {
        allowedPaths: [
          process.env.HOME + '/Downloads/**'
        ]
      }
    }]
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | grep -A5 approvalEngine || echo "No errors for approvalEngine"`

Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add electron/approvalEngine.ts
git commit -m "feat: add browser tool permissions to ApprovalEngine"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 12: Add Browser Tools to MCP Proxy - Navigation Tools

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add browser manager to class**

Add to constructor parameters and class properties:

```typescript
  private browserManager: ReturnType<typeof import('./browserManager.js').getBrowserManager>

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
    this.browserManager = (await import('./browserManager.js')).getBrowserManager()
  }
```

**Step 2: Add browser_navigate tool definition**

Add to `getAvailableTools` method:

```typescript
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL in the browser',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', description: 'Page ID (default: "main")' },
            url: { type: 'string', description: 'Target URL to navigate to' },
            waitUntil: {
              type: 'string',
              enum: ['load', 'domcontentloaded', 'networkidle'],
              description: 'When to consider navigation succeeded'
            }
          },
          required: ['url']
        }
      }
```

**Step 3: Add browser_navigate execution case**

Add to `executeTool` method:

```typescript
      case 'browser_navigate':
        const browserNavResult = await this.browserManager.goto(
          (args.pageId as string) || 'main',
          args.url as string,
          (args.waitUntil as any) || 'load'
        )
        if (browserNavResult.success) {
          return {
            content: [{
              type: 'text',
              text: `Navigated to ${browserNavResult.data.url} (status: ${browserNavResult.data.status})`
            }]
          }
        } else {
          return {
            content: [{ type: 'text', text: browserNavResult.error || 'Navigation failed' }],
            isError: true
          }
        }
```

**Step 4: Run build to verify**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -10 || echo "Build successful"`

Expected: No errors

**Step 5: Commit**

```bash
git add electron/mcpProxyServer.ts
git commit -m "feat: add browser_navigate tool to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 13: Add Screenshot and Text Tools to MCP Proxy

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add tool definitions**

Add to `getAvailableTools` method:

```typescript
      {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            fullPage: { type: 'boolean', default: false, description: 'Capture full page scroll' }
          }
        }
      },
      {
        name: 'browser_text',
        description: 'Extract text content from the page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'Optional CSS selector to limit text extraction' }
          }
        }
      }
```

**Step 2: Add execution cases**

Add to `executeTool` method:

```typescript
      case 'browser_screenshot':
        const screenshotResult = await this.browserManager.screenshot(
          (args.pageId as string) || 'main',
          args.fullPage as boolean
        )
        if (screenshotResult.success) {
          return {
            content: [{
              type: 'text',
              text: `Screenshot captured (${screenshotResult.data.size} bytes, format: ${screenshotResult.data.format})`,
              data: screenshotResult.data
            }]
          }
        } else {
          return {
            content: [{ type: 'text', text: screenshotResult.error || 'Screenshot failed' }],
            isError: true
          }
        }

      case 'browser_text':
        const textResult = await this.browserManager.getText(
          (args.pageId as string) || 'main',
          args.selector as string | undefined
        )
        if (textResult.success) {
          return {
            content: [{
              type: 'text',
              text: textResult.data.text
            }]
          }
        } else {
          return {
            content: [{ type: 'text', text: textResult.error || 'Failed to extract text' }],
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
git commit -m "feat: add screenshot and text tools to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 14: Add Interaction Tools to MCP Proxy

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add tool definitions**

Add to `getAvailableTools` method:

```typescript
      {
        name: 'browser_click',
        description: 'Click an element on the page',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'CSS selector for the element' },
            timeout: { type: 'number', default: 30000, description: 'Timeout in milliseconds' }
          },
          required: ['selector']
        }
      },
      {
        name: 'browser_fill',
        description: 'Fill a form input field',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'CSS selector for the input' },
            value: { type: 'string', description: 'Value to fill' }
          },
          required: ['selector', 'value']
        }
      },
      {
        name: 'browser_wait',
        description: 'Wait for an element to appear',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'CSS selector to wait for' },
            timeout: { type: 'number', default: 30000 }
          },
          required: ['selector']
        }
      }
```

**Step 2: Add execution cases**

Add to `executeTool` method:

```typescript
      case 'browser_click':
        const clickResult = await this.browserManager.click(
          (args.pageId as string) || 'main',
          args.selector as string,
          args.timeout as number
        )
        if (clickResult.success) {
          return {
            content: [{ type: 'text', text: `Clicked: ${clickResult.data.selector}` }]
          }
        } else {
          return {
            content: [{ type: 'text', text: clickResult.error || 'Click failed' }],
            isError: true
          }
        }

      case 'browser_fill':
        const fillResult = await this.browserManager.fill(
          (args.pageId as string) || 'main',
          args.selector as string,
          args.value as string
        )
        if (fillResult.success) {
          return {
            content: [{ type: 'text', text: `Filled ${fillResult.data.selector} with value` }]
          }
        } else {
          return {
            content: [{ type: 'text', text: fillResult.error || 'Fill failed' }],
            isError: true
          }
        }

      case 'browser_wait':
        const waitResult = await this.browserManager.waitFor(
          (args.pageId as string) || 'main',
          args.selector as string,
          args.timeout as number
        )
        if (waitResult.success) {
          return {
            content: [{ type: 'text', text: `Element appeared: ${waitResult.data.selector}` }]
          }
        } else {
          return {
            content: [{ type: 'text', text: waitResult.error || 'Wait failed' }],
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
git commit -m "feat: add interaction tools to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 15: Add Advanced Tools to MCP Proxy

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add tool definitions**

Add to `getAvailableTools` method:

```typescript
      {
        name: 'browser_evaluate',
        description: 'Execute JavaScript in the page (requires approval)',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            script: { type: 'string', description: 'JavaScript code to execute' }
          },
          required: ['script']
        }
      },
      {
        name: 'browser_cookies',
        description: 'Get or set cookies (requires approval)',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            action: { type: 'string', enum: ['get', 'set', 'getAll'] },
            cookie: { type: 'object', description: 'Cookie object (for set action)' }
          },
          required: ['action']
        }
      }
```

**Step 2: Add execution cases**

Add to `executeTool` method:

```typescript
      case 'browser_evaluate':
        const evalResult = await this.browserManager.evaluate(
          (args.pageId as string) || 'main',
          args.script as string
        )
        if (evalResult.success) {
          return {
            content: [{
              type: 'text',
              text: `Result: ${JSON.stringify(evalResult.data.result)}`
            }]
          }
        } else {
          return {
            content: [{ type: 'text', text: evalResult.error || 'Evaluate failed' }],
            isError: true
          }
        }

      case 'browser_cookies':
        const cookieResult = await this.browserManager.cookies(
          (args.pageId as string) || 'main',
          args.action as any,
          args.cookie as any
        )
        if (cookieResult.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(cookieResult.data, null, 2)
            }]
          }
        } else {
          return {
            content: [{ type: 'text', text: cookieResult.error || 'Cookies operation failed' }],
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
git commit -m "feat: add advanced tools to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 16: Add File Handling Tools to MCP Proxy

**Files:**
- Modify: `electron/mcpProxyServer.ts`

**Step 1: Add tool definitions**

Add to `getAvailableTools` method:

```typescript
      {
        name: 'browser_upload',
        description: 'Upload a file (requires approval)',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'File input selector' },
            filePath: { type: 'string', description: 'Path to file to upload' }
          },
          required: ['selector', 'filePath']
        }
      },
      {
        name: 'browser_download',
        description: 'Download a file (requires approval)',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', default: 'main' },
            selector: { type: 'string', description: 'Element that triggers download' },
            savePath: { type: 'string', description: 'Where to save the file' }
          },
          required: ['selector', 'savePath']
        }
      }
```

**Step 2: Add execution cases**

Add to `executeTool` method:

```typescript
      case 'browser_upload':
        const uploadResult = await this.browserManager.upload(
          (args.pageId as string) || 'main',
          args.selector as string,
          args.filePath as string
        )
        if (uploadResult.success) {
          return {
            content: [{ type: 'text', text: `Uploaded: ${uploadResult.data.filePath}` }]
          }
        } else {
          return {
            content: [{ type: 'text', text: uploadResult.error || 'Upload failed' }],
            isError: true
          }
        }

      case 'browser_download':
        const downloadResult = await this.browserManager.download(
          (args.pageId as string) || 'main',
          args.selector as string,
          args.savePath as string
        )
        if (downloadResult.success) {
          return {
            content: [{ type: 'text', text: `Downloaded: ${downloadResult.data.filename} to ${downloadResult.data.savePath}` }]
          }
        } else {
          return {
            content: [{ type: 'text', text: downloadResult.error || 'Download failed' }],
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
git commit -m "feat: add file handling tools to MCP proxy"

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Task 17: Final Build and Verification

**Files:**
- All modified files

**Step 1: Run full build**

Run: `npm run build`

Expected: Build completes successfully with no TypeScript errors

**Step 2: Verify BrowserManager exports**

Run: `grep -n "export class BrowserManager" electron/browserManager.ts`

Expected: Shows the export line

**Step 3: Verify all browser tool definitions**

Run: `grep -E "name: 'browser_" electron/mcpProxyServer.ts | grep "name:"`

Expected: Shows all 10 browser tool names (navigate, screenshot, text, click, fill, wait, evaluate, cookies, upload, download)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 4 browser automation implementation

- Created BrowserManager with Playwright integration
- Implemented all browser operations (navigate, click, fill, screenshot, text, wait, evaluate, cookies, upload, download)
- Integrated with ApprovalEngine for permission control
- Added all tools to MCP proxy
- Browser launches on app startup (headless: false, visible to user)

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

## Summary

This plan implements complete browser automation capability for Claude Code:

**17 Tasks organized into 5 phases:**
1. **Setup** (Task 1): Install Playwright
2. **Core Browser Management** (Tasks 2-4): BrowserManager class, initialization, page management
3. **Basic Operations** (Tasks 5-6): Navigation, screenshot, click, fill, text
4. **Advanced Operations** (Tasks 7-9): Wait, evaluate, cookies, upload, download
5. **Integration** (Tasks 10-16): Wire up with main.ts, ApprovalEngine, MCP proxy
6. **Verification** (Task 17): Final build and testing

**Key Features:**
- Persistent browser (launches on app startup, visible to user)
- 10 MCP tools covering all browser automation needs
- Approval integration for sensitive operations
- Complete logging of all browser operations
