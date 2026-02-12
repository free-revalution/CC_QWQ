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
  private initPromise: Promise<void> | null = null

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
   * 确保浏览器已初始化（懒加载）
   * 在任何需要浏览器的操作前调用此方法
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized()) {
      return
    }

    // 如果正在初始化，等待完成
    if (this.initPromise) {
      await this.initPromise
      return
    }

    // 开始初始化
    this.initPromise = this.initialize()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
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
    console.log('[BrowserManager] Initializing browser on demand...')

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
        } catch {
          // Ignore errors during cleanup
        }
        this.context = null
      }
      if (this.browser) {
        try {
          await this.browser.close()
        } catch {
          // Ignore errors during cleanup
        }
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate URL and protocol
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return {
        success: false,
        error: `Invalid URL: ${url}`
      }
    }

    // Protocol whitelist - only allow http and https
    const allowedProtocols = ['http:', 'https:']
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return {
        success: false,
        error: `Protocol not allowed: ${urlObj.protocol}. Only http and https are permitted.`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
  async waitFor(pageId: string, selector: string, timeout?: number): Promise<BrowserResult<void>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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

    // Validate timeout
    const waitTimeout = timeout || 30000
    if (waitTimeout <= 0) {
      return {
        success: false,
        error: 'Timeout must be positive'
      }
    }

    try {
      console.log(`[BrowserManager] Waiting for element on page '${pageId}': ${selector} (timeout: ${waitTimeout}ms)`)

      await page.waitForSelector(selector, { timeout: waitTimeout })

      console.log(`[BrowserManager] Element found on page '${pageId}': ${selector}`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to wait for element:', errorMessage)
      return {
        success: false,
        error: `Failed to wait for element: ${errorMessage}`
      }
    }
  }

  /**
   * 执行 JavaScript
   *
   * ⚠️ SECURITY WARNING: This method uses eval() to execute arbitrary JavaScript code.
   * - NEVER expose this method to untrusted input
   * - Always validate and sanitize script input before calling
   * - This method can execute ANY JavaScript code in the browser context
   * - Use with extreme caution in production environments
   *
   * Note: eval() is necessary here to provide dynamic JavaScript execution capabilities
   * for browser automation. This is an acceptable use case for a development/automation tool,
   * but requires careful input validation and should never be exposed to untrusted users.
   *
   * @param pageId - Page ID
   * @param script - JavaScript code to execute (will be eval'd)
   * @returns Result of script execution
   */
  async evaluate<T = unknown>(pageId: string, script: string): Promise<BrowserResult<T>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate script
    if (!script || script.trim().length === 0) {
      return {
        success: false,
        error: 'Script cannot be empty'
      }
    }

    try {
      console.log(`[BrowserManager] Evaluating script on page '${pageId}'`)

      const result = await page.evaluate((js: string) => {
        return eval(js)
      }, script)

      console.log(`[BrowserManager] Script evaluated on page '${pageId}'`)

      return {
        success: true,
        data: result as T
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to evaluate script:', errorMessage)
      return {
        success: false,
        error: `Failed to evaluate script: ${errorMessage}`
      }
    }
  }

  /**
   * 获取所有 Cookies
   */
  async getCookies(pageId: string): Promise<BrowserResult<CookieOptions[]>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
      console.log(`[BrowserManager] Getting cookies for page '${pageId}'`)

      const cookies = await page.context().cookies()

      // 转换为我们的 CookieOptions 格式
      const cookieOptions: CookieOptions[] = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expiry: c.expires
      }))

      console.log(`[BrowserManager] Retrieved ${cookieOptions.length} cookies for page '${pageId}'`)

      return {
        success: true,
        data: cookieOptions
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to get cookies:', errorMessage)
      return {
        success: false,
        error: `Failed to get cookies: ${errorMessage}`
      }
    }
  }

  /**
   * 设置 Cookie
   */
  async setCookie(pageId: string, cookie: CookieOptions): Promise<BrowserResult<void>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const page = this.getPage(pageId)
    if (!page) {
      return {
        success: false,
        error: `Page not found: ${pageId}`
      }
    }

    // Validate cookie
    if (!cookie.name || cookie.name.trim().length === 0) {
      return {
        success: false,
        error: 'Cookie name cannot be empty'
      }
    }

    if (cookie.value === undefined || cookie.value === null) {
      return {
        success: false,
        error: 'Cookie value cannot be undefined or null'
      }
    }

    try {
      console.log(`[BrowserManager] Setting cookie on page '${pageId}': ${cookie.name}`)

      await page.context().addCookies([
        {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expiry
        }
      ])

      console.log(`[BrowserManager] Cookie set on page '${pageId}': ${cookie.name}`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to set cookie:', errorMessage)
      return {
        success: false,
        error: `Failed to set cookie: ${errorMessage}`
      }
    }
  }

  /**
   * 上传文件
   */
  async upload(pageId: string, selector: string, filePath: string): Promise<BrowserResult<void>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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

    // Validate file path
    if (!filePath || filePath.trim().length === 0) {
      return {
        success: false,
        error: 'File path cannot be empty'
      }
    }

    try {
      console.log(`[BrowserManager] Uploading file to page '${pageId}': ${filePath}`)

      // 使用 setInputFiles 上传文件
      await page.setInputFiles(selector, filePath)

      console.log(`[BrowserManager] File uploaded to page '${pageId}'`)

      return {
        success: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to upload file:', errorMessage)
      return {
        success: false,
        error: `Failed to upload file: ${errorMessage}`
      }
    }
  }

  /**
   * 下载文件
   */
  async download(pageId: string, selector: string): Promise<BrowserResult<string>> {
    // 懒加载：自动初始化浏览器
    try {
      await this.ensureInitialized()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize browser: ${error instanceof Error ? error.message : String(error)}`
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
      console.log(`[BrowserManager] Downloading file from page '${pageId}': ${selector}`)

      // 设置下载处理
      const downloadPromise = page.waitForEvent('download')

      // 点击下载元素
      await page.click(selector)

      // 等待下载开始
      const download = await downloadPromise

      // 获取保存路径（使用临时目录）
      const savePath = path.join(os.tmpdir(), `claude-download-${Date.now()}-${download.suggestedFilename()}`)

      // 保存文件
      await download.saveAs(savePath)

      console.log(`[BrowserManager] File downloaded to: ${savePath}`)

      return {
        success: true,
        data: savePath
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[BrowserManager] Failed to download file:', errorMessage)
      return {
        success: false,
        error: `Failed to download file: ${errorMessage}`
      }
    }
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
