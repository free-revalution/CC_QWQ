/**
 * Bot State Synchronization
 *
 * Handles bidirectional synchronization between chat platforms and desktop.
 * Syncs messages, conversation state, and permissions.
 */

import type { BotMessage } from '../../types/bot';
import { botManager } from '../index';
import { whatsappIntegration, feishuIntegration } from '../integration/claude';
import { ipc } from '../../lib/ipc';
import type { Message } from '../types/messages';

export interface SyncConfig {
  /** Sync interval in milliseconds (0 for event-only) */
  syncInterval?: number;
  /** Maximum messages to sync per batch */
  maxMessages?: number;
  /** Whether to sync conversation list */
  syncConversations?: boolean;
}

export interface SyncState {
  lastSyncTime: number;
  lastMessageId: string | null;
  conversationsSynced: number;
  messagesSynced: number;
  errors: number;
}

export class BotStateSync {
  private config: Required<SyncConfig>;
  private state: Map<'whatsapp' | 'feishu', SyncState>;
  private syncIntervals: Map<'whatsapp' | 'feishu', NodeJS.Timeout>;
  private streamCleanupId: string | null = null;

  constructor(config: SyncConfig = {}) {
    this.config = {
      syncInterval: config.syncInterval ?? 0, // Event-only by default
      maxMessages: config.maxMessages ?? 50,
      syncConversations: config.syncConversations ?? true,
    };

    this.state = new Map([
      ['whatsapp', this.createSyncState()],
      ['feishu', this.createSyncState()],
    ]);

    this.syncIntervals = new Map();
  }

  private createSyncState(): SyncState {
    return {
      lastSyncTime: 0,
      lastMessageId: null,
      conversationsSynced: 0,
      messagesSynced: 0,
      errors: 0,
    };
  }

  /**
   * Start synchronization for a platform
   */
  async start(platform: 'whatsapp' | 'feishu'): Promise<void> {
    console.log(`[BotStateSync] Starting sync for ${platform}`);

    // Set up Claude stream listener
    if (!this.streamCleanupId) {
      this.setupStreamListener();
    }

    // If periodic sync is enabled, set up interval
    if (this.config.syncInterval > 0) {
      const interval = setInterval(() => {
        this.syncToChat(platform).catch(err => {
          console.error(`[${platform}] Sync error:`, err);
          const state = this.state.get(platform);
          if (state) state.errors++;
        });
      }, this.config.syncInterval);

      this.syncIntervals.set(platform, interval);
    }

    // Initial sync
    await this.syncToChat(platform);
  }

  /**
   * Stop synchronization for a platform
   */
  stop(platform: 'whatsapp' | 'feishu'): void {
    console.log(`[BotStateSync] Stopping sync for ${platform}`);

    const interval = this.syncIntervals.get(platform);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(platform);
    }
  }

  /**
   * Stop all synchronization
   */
  stopAll(): void {
    this.state.forEach((_, platform) => this.stop(platform));

    if (this.streamCleanupId) {
      ipc.removeListener(this.streamCleanupId);
      this.streamCleanupId = null;
    }
  }

  /**
   * Set up Claude stream listener for real-time sync
   */
  private setupStreamListener(): void {
    this.streamCleanupId = ipc.onClaudeStream((data: {
      conversationId: string;
      messageId: string;
      type: string;
      content: string;
      toolName?: string;
      toolInput?: string;
      timestamp: number;
    }) => {
      this.handleClaudeStream(data).catch(err => {
        console.error('[BotStateSync] Stream handling error:', err);
      });
    });
  }

  /**
   * Handle incoming Claude stream data
   */
  private async handleClaudeStream(data: {
    conversationId: string;
    messageId: string;
    type: string;
    content: string;
    toolName?: string;
    toolInput?: string;
    timestamp: number;
  }): Promise<void> {
    // Determine which platform(s) to sync to
    // For now, we sync to both active platforms
    for (const platform of ['whatsapp', 'feishu'] as const) {
      const integration = platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;

      // Only sync if this platform has an active conversation
      const currentConv = integration.getCurrentConversation?.();
      if (!currentConv) continue;

      // Check if this stream belongs to the active conversation
      if (currentConv.id !== data.conversationId) continue;

      // Format and send message
      const message = this.formatStreamMessage(data);
      await botManager.sendMessage(platform, 'default', message);

      // Update sync state
      const state = this.state.get(platform);
      if (state) {
        state.lastMessageId = data.messageId;
        state.lastSyncTime = Date.now();
        state.messagesSynced++;
      }
    }
  }

  /**
   * Format Claude stream data for chat display
   */
  private formatStreamMessage(data: {
    conversationId: string;
    messageId: string;
    type: string;
    content: string;
    toolName?: string;
    toolInput?: string;
    timestamp: number;
  }): string {
    switch (data.type) {
      case 'text':
        return `🤖 ${data.content}`;

      case 'tool_use': {
        let toolMsg = `🔧 工具调用: ${data.toolName}`;
        if (data.toolInput && data.toolInput.length < 200) {
          toolMsg += `\n${data.toolInput}`;
        }
        return toolMsg;
      }

      case 'tool_result':
        return `✅ 工具完成`;

      case 'error':
        return `❌ 错误: ${data.content}`;

      default:
        return `📝 ${data.content}`;
    }
  }

  /**
   * Sync messages from desktop to chat platform
   */
  private async syncToChat(platform: 'whatsapp' | 'feishu'): Promise<void> {
    const integration = platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;
    const state = this.state.get(platform);
    if (!state) return;

    try {
      // Get active conversation
      const currentConv = integration.getCurrentConversation?.();
      if (!currentConv) return;

      // Get messages from integration
      const messages = integration.getMessages(this.config.maxMessages);

      if (messages.length === 0) return;

      // Find new messages (since last sync)
      const newMessages = messages.filter(m => {
        if (state.lastMessageId) {
          return m.id !== state.lastMessageId && m.timestamp > state.lastSyncTime;
        }
        return m.timestamp > state.lastSyncTime;
      });

      if (newMessages.length === 0) return;

      // Format and send new messages
      for (const msg of newMessages) {
        const formatted = this.formatMessageForChat(msg);
        if (formatted) {
          await botManager.sendMessage(platform, 'default', formatted);
        }
      }

      // Update state
      state.lastSyncTime = Date.now();
      state.messagesSynced += newMessages.length;

      console.log(`[${platform}] Synced ${newMessages.length} messages to chat`);
    } catch (error) {
      console.error(`[${platform}] Sync error:`, error);
      state.errors++;
    }
  }

  /**
   * Format message for chat display
   */
  private formatMessageForChat(msg: Message): string | null {
    switch (msg.kind) {
      case 'user-text':
        return `👤 ${msg.content}`;

      case 'agent-text':
        return `🤖 ${msg.content}`;

      case 'tool-call':
        return `🔧 调用: ${msg.tool.name}`;

      case 'tool-result':
        return `✅ 完成: ${msg.toolName}`;

      case 'permission': {
        const perm = msg.permission;
        let permText = `🔔 权限请求\n工具: ${perm.toolName}`;
        if (perm.status === 'pending') {
          permText += '\n回复 /approve 或 /deny';
        }
        return permText;
      }

      case 'error':
        return `❌ 错误: ${msg.error.message}`;

      default:
        return null;
    }
  }

  /**
   * Sync chat message to desktop
   */
  async syncFromChat(botMessage: BotMessage): Promise<void> {
    const integration = botMessage.platform === 'whatsapp' ? whatsappIntegration : feishuIntegration;

    // Send to Claude via integration
    await integration.sendMessage(botMessage.content);
  }

  /**
   * Get sync state for a platform
   */
  getSyncState(platform: 'whatsapp' | 'feishu'): SyncState | undefined {
    return this.state.get(platform);
  }

  /**
   * Get all sync states
   */
  getAllSyncStates(): Map<'whatsapp' | 'feishu', SyncState> {
    return new Map(this.state);
  }

  /**
   * Reset sync state for a platform
   */
  resetSyncState(platform: 'whatsapp' | 'feishu'): void {
    this.state.set(platform, this.createSyncState());
  }

  /**
   * Reset all sync states
   */
  resetAllSyncStates(): void {
    this.state.forEach((_, platform) => this.resetSyncState(platform));
  }
}

// Global sync instance
export const botStateSync = new BotStateSync();
