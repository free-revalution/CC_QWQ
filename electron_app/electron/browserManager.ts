/**
 * Browser Manager - 浏览器管理器
 *
 * 使用 Playwright 控制浏览器实例
 * 单例模式，全局唯一实例
 */

import * as path from 'path'
import * as os from 'os'
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

export class BrowserManager {
  private static instance: BrowserManager | null = null
  private static readonly DEFAULT_PAGE_ID = 'main'

  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private pages: Map<string, Page> = new Map()
  private config: BrowserConfig

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

      console.log('[BrowserManager] Browser initialized successfully')
    } catch (error) {
      console.error('[BrowserManager] Failed to initialize browser:', error)
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
      for (const [pageId, page] of this.pages.entries()) {
        try {
          await page.close()
          console.log(`[BrowserManager] Page ${pageId} closed`)
        } catch (error) {
          console.error(`[BrowserManager] Failed to close page ${pageId}:`, error)
        }
      }
      this.pages.clear()

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

      console.log('[BrowserManager] Browser closed successfully')
    } catch (error) {
      console.error('[BrowserManager] Error closing browser:', error)
      throw error
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null
  }

  /**
   * 创建新页面
   */
  async newPage(): Promise<BrowserResult> {
    // TODO: Task 4 - Implement page creation
    throw new Error('Not implemented')
  }

  /**
   * 关闭指定页面
   */
  async closePage(): Promise<BrowserResult> {
    // TODO: Task 4 - Implement page closing
    throw new Error('Not implemented')
  }

  /**
   * 获取所有页面
   */
  listPages(): string[] {
    // TODO: Task 4 - List all pages
    throw new Error('Not implemented')
  }

  /**
   * 导航到 URL
   */
  async goto(): Promise<BrowserResult> {
    // TODO: Task 5 - Implement navigation
    throw new Error('Not implemented')
  }

  /**
   * 截图
   */
  async screenshot(): Promise<BrowserResult> {
    // TODO: Task 5 - Implement screenshot
    throw new Error('Not implemented')
  }

  /**
   * 点击元素
   */
  async click(): Promise<BrowserResult> {
    // TODO: Task 6 - Implement click
    throw new Error('Not implemented')
  }

  /**
   * 填写输入框
   */
  async fill(): Promise<BrowserResult> {
    // TODO: Task 6 - Implement fill
    throw new Error('Not implemented')
  }

  /**
   * 获取元素文本
   */
  async getText(): Promise<BrowserResult> {
    // TODO: Task 6 - Implement get text
    throw new Error('Not implemented')
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
