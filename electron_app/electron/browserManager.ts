/**
 * Browser Manager - 浏览器管理器
 *
 * 使用 Playwright 控制浏览器实例
 * 单例模式，全局唯一实例
 */

import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

// 配置选项
export interface BrowserConfig {
  headless?: boolean
  viewport?: { width: number; height: number }
  userDataDir?: string
}

// 页面选项
export interface PageOptions {
  id?: string
  viewport?: { width: number; height: number }
}

// 操作结果
export interface BrowserResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 导航选项
export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  timeout?: number
}

// 截图选项
export interface ScreenshotOptions {
  path?: string
  type?: 'png' | 'jpeg'
  fullPage?: boolean
}

// Cookie 操作
export interface CookieOptions {
  name: string
  value: string
  domain?: string
  path?: string
  expiry?: number
}

type InitializationState = 'uninitialized' | 'initializing' | 'initialized'

export class BrowserManager {
  private static instance: BrowserManager | null = null
  private static readonly DEFAULT_PAGE_ID = 'main'

  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages: Map<string, Page> = new Map()
  private config: BrowserConfig
  private initializationState: InitializationState = 'uninitialized'

  private constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: false,
      viewport: { width: 1280, height: 720 },
      userDataDir: path.join(os.homedir(), '.claude-browser'),
      ...config
    }
  }

  /**
   * 获取单例实例
   *
   * @param config - 配置选项，仅在首次调用时生效。如果实例已存在，此参数将被忽略。
   * @returns BrowserManager 单例实例
   */
  static getInstance(config?: BrowserConfig): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(config)
    }
    return BrowserManager.instance
  }

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized()) {
      console.log('[BrowserManager] Browser already initialized')
      return
    }

    // Prevent race condition with concurrent initialization attempts
    if (this.initializationState === 'initializing') {
      console.log('[BrowserManager] Browser initialization already in progress')
      return
    }

    this.initializationState = 'initializing'

    try {
      console.log('[BrowserManager] Initializing browser...')

      // 使用系统Chrome，非headless模式
      const launchOptions = {
        headless: this.config.headless ?? false,
        channel: 'chrome' as const,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ]
      }

      this.browser = await chromium.launch(launchOptions)
      console.log('[BrowserManager] Browser launched')

      // 创建浏览器上下文
      this.context = await this.browser.newContext({
        viewport: this.config.viewport || { width: 1280, height: 720 },
        userAgent: 'Claude Code Browser Automation (https://claude.com/claude-code)',
        acceptDownloads: true,
      })

      console.log('[BrowserManager] Browser context created')

      // 创建默认页面
      const defaultPage = await this.context.newPage()
      this.pages.set(BrowserManager.DEFAULT_PAGE_ID, defaultPage)
      console.log('[BrowserManager] Default page created')

      this.initializationState = 'initialized'
      console.log('[BrowserManager] Browser initialized successfully')
    } catch (error) {
      console.error('[BrowserManager] Failed to initialize browser:', error instanceof Error ? error.message : String(error))

      // Clean up any resources that were successfully created
      if (this.pages.size > 0) {
        const failedPageCloses: string[] = []
        for (const [pageId, page] of this.pages.entries()) {
          try {
            await page.close()
          } catch {
            failedPageCloses.push(pageId)
          }
        }
        this.pages.clear()
        if (failedPageCloses.length > 0) {
          console.error(`[BrowserManager] Failed to close pages during cleanup: ${failedPageCloses.join(', ')}`)
        }
      }
      if (this.context) {
        try {
          await this.context.close()
        } catch {}
        this.context = null
      }
      if (this.browser) {
        try {
          await this.browser.close()
        } catch {}
        this.browser = null
      }

      this.initializationState = 'uninitialized'
      throw error
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (!this.isInitialized()) {
      console.log('[BrowserManager] Browser not initialized, nothing to close')
      return
    }

    try {
      console.log('[BrowserManager] Closing browser...')

      // 关闭所有页面
      const failedPageCloses: string[] = []
      for (const [pageId, page] of this.pages.entries()) {
        try {
          await page.close()
          console.log(`[BrowserManager] Page ${pageId} closed`)
        } catch (error) {
          console.error(`[BrowserManager] Failed to close page ${pageId}:`, error instanceof Error ? error.message : String(error))
          failedPageCloses.push(pageId)
        }
      }
      this.pages.clear()

      if (failedPageCloses.length > 0) {
        console.warn(`[BrowserManager] Some pages failed to close: ${failedPageCloses.join(', ')}`)
      }

      // 关闭上下文
      if (this.context) {
        await this.context.close()
        this.context = null
      }

      // 关闭浏览器
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }

      this.initializationState = 'uninitialized'
      console.log('[BrowserManager] Browser closed successfully')
    } catch (error) {
      console.error('[BrowserManager] Error closing browser:', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initializationState === 'initialized' &&
           this.browser !== null &&
           this.context !== null
  }

  /**
   * 创建新页面
   */
  async newPage(options: PageOptions = {}): Promise<BrowserResult<string>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    try {
      const pageId = options.id || `page-${crypto.randomUUID()}`

      // Validate page ID
      if (!pageId || pageId.trim().length === 0) {
        return {
          success: false,
          error: 'Page ID cannot be empty'
        }
      }

      // 检查 ID 是否已存在
      if (this.pages.has(pageId)) {
        return {
          success: false,
          error: `Page with ID '${pageId}' already exists`
        }
      }

      // Validate viewport dimensions
      const viewport = options.viewport || this.config.viewport
      if (viewport.width <= 0 || viewport.height <= 0) {
        return {
          success: false,
          error: 'Invalid viewport dimensions'
        }
      }

      console.log(`[BrowserManager] Creating new page: ${pageId}`)

      // 创建新页面
      const page = await this.context!.newPage({
        viewport
      })

      this.pages.set(pageId, page)
      console.log(`[BrowserManager] Page created: ${pageId}`)

      return {
        success: true,
        data: pageId
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to create page:', errorMessage)
      return {
        success: false,
        error: `Failed to create page: ${errorMessage}`
      }
    }
  }

  /**
   * 关闭指定页面
   */
  async closePage(pageId: string): Promise<BrowserResult<void>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.pages.get(pageId)

    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // 不允许关闭默认页面
    if (pageId === BrowserManager.DEFAULT_PAGE_ID) {
      return {
        success: false,
        error: 'Cannot close default page'
      }
    }

    try {
      console.log(`[BrowserManager] Closing page: ${pageId}`)
      await page.close()
      this.pages.delete(pageId)
      console.log(`[BrowserManager] Page closed: ${pageId}`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to close page:', errorMessage)
      return {
        success: false,
        error: `Failed to close page: ${errorMessage}`
      }
    }
  }

  /**
   * 获取所有页面 ID
   */
  listPages(): string[] {
    return Array.from(this.pages.keys())
  }

  /**
   * 导航到 URL
   */
  async goto(pageId: string, url: string, options: NavigateOptions = {}): Promise<BrowserResult<void>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return {
        success: false,
        error: `Invalid URL: ${url}`
      }
    }

    try {
      console.log(`[BrowserManager] Navigating page '${pageId}' to: ${url}`)

      const waitUntil = options.waitUntil || 'load'
      const timeout = options.timeout || 30000

      await page.goto(url, {
        waitUntil,
        timeout
      })

      console.log(`[BrowserManager] Navigation complete for page '${pageId}'`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to navigate:', errorMessage)
      return {
        success: false,
        error: `Failed to navigate: ${errorMessage}`
      }
    }
  }

  /**
   * 截图
   */
  async screenshot(pageId: string, options: ScreenshotOptions = {}): Promise<BrowserResult<string>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    try {
      console.log(`[BrowserManager] Taking screenshot of page '${pageId}'`)

      const screenshot = await page.screenshot({
        path: options.path,
        type: options.type || 'png',
        fullPage: options.fullPage || false
      })

      // 返回 base64 编码的图片
      const base64 = screenshot.toString('base64')

      console.log(`[BrowserManager] Screenshot taken for page '${pageId}' (${base64.length} bytes)`)

      return {
        success: true,
        data: base64
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to take screenshot:', errorMessage)
      return {
        success: false,
        error: `Failed to take screenshot: ${errorMessage}`
      }
    }
  }

  /**
   * 点击元素
   */
  async click(pageId: string, selector: string): Promise<BrowserResult<void>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate selector
    if (!selector || selector.trim().length === 0) {
      return {
        success: false,
        error: 'Selector cannot be empty'
      }
    }

    try {
      console.log(`[BrowserManager] Clicking element on page '${pageId}': ${selector}`)

      await page.click(selector)

      console.log(`[BrowserManager] Element clicked on page '${pageId}'`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to click element:', errorMessage)
      return {
        success: false,
        error: `Failed to click element: ${errorMessage}`
      }
    }
  }

  /**
   * 填写输入框
   */
  async fill(pageId: string, selector: string, value: string): Promise<BrowserResult<void>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate selector
    if (!selector || selector.trim().length === 0) {
      return {
        success: false,
        error: 'Selector cannot be empty'
      }
    }

    try {
      console.log(`[BrowserManager] Filling element on page '${pageId}': ${selector}`)

      await page.fill(selector, value)

      console.log(`[BrowserManager] Element filled on page '${pageId}'`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to fill element:', errorMessage)
      return {
        success: false,
        error: `Failed to fill element: ${errorMessage}`
      }
    }
  }

  /**
   * 获取元素文本
   */
  async getText(pageId: string, selector: string): Promise<BrowserResult<string>> {
    if (!this.isInitialized()) {
      return {
        success: false,
        error: 'Browser not initialized'
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate selector
    if (!selector || selector.trim().length === 0) {
      return {
        success: false,
        error: 'Selector cannot be empty'
      }
    }

    try {
      console.log(`[BrowserManager] Getting text from element on page '${pageId}': ${selector}`)

      const text = await page.textContent(selector)

      console.log(`[BrowserManager] Text retrieved from page '${pageId}'`)

      return {
        success: true,
        data: text || ''
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to get text:', errorMessage)
      return {
        success: false,
        error: `Failed to get text: ${errorMessage}`
      }
    }
  }

  /**
   * 等待元素
   */
  async waitFor(): Promise<BrowserResult> {
    // TODO: Task 7 - Implement wait for
    throw new Error('Not implemented')
  }

  /**
   * 执行 JavaScript
   */
  async evaluate(): Promise<BrowserResult> {
    // TODO: Task 7 - Implement evaluate
    throw new Error('Not implemented')
  }

  /**
   * 获取所有 Cookies
   */
  async getCookies(): Promise<BrowserResult> {
    // TODO: Task 8 - Implement get cookies
    throw new Error('Not implemented')
  }

  /**
   * 设置 Cookie
   */
  async setCookie(): Promise<BrowserResult> {
    // TODO: Task 8 - Implement set cookie
    throw new Error('Not implemented')
  }

  /**
   * 上传文件
   */
  async upload(): Promise<BrowserResult> {
    // TODO: Task 9 - Implement upload
    throw new Error('Not implemented')
  }

  /**
   * 下载文件
   */
  async download(): Promise<BrowserResult> {
    // TODO: Task 9 - Implement download
    throw new Error('Not implemented')
  }

  /**
   * 获取指定页面
   */
  private getPage(pageId: string): Page | null {
    return this.pages.get(pageId) || null
  }

  /**
   * 获取或创建默认页面
   */
  private async getOrCreateDefaultPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized')
    }

    let page = this.pages.get(BrowserManager.DEFAULT_PAGE_ID)

    if (!page) {
      page = await this.context.newPage()
      this.pages.set(BrowserManager.DEFAULT_PAGE_ID, page)
    }

    return page
  }
}

/**
 * 导出单例访问函数
 */
export function getBrowserManager(config?: BrowserConfig): BrowserManager {
  return BrowserManager.getInstance(config)
}
