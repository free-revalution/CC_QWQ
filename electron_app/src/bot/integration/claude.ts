/**
 * Claude Code Integration for Bot System
 *
 * Bridges the bot message system with Claude Code IPC.
 */

import { messageReducer, createReducerState } from '../reducer/reducer';
import type { ReducerState } from '../types/reducer';
import type { Message, PermissionMessage } from '../types/messages';
import { ipc } from '../../lib/ipc';

export interface ClaudeIntegrationConfig {
  conversationId: string;
  projectPath: string;
  platform: 'whatsapp' | 'feishu';
}

/**
 * Extended permission data with conversation context
 */
interface PendingPermissionData {
  conversationId: string;
  toolName: string;
  input: any;
  createdAt: number;
  expiresAt: number;
}

export class ClaudeIntegration {
  private state: ReducerState;
  private currentConversation: string | null = null;
  private currentProject: string | null = null;
  private platform: 'whatsapp' | 'feishu';
  private permissionTimeoutMs: number = 5 * 60 * 1000; // 5 minutes default
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(platform: 'whatsapp' | 'feishu') {
    this.platform = platform;
    this.state = createReducerState();
    this.startCleanupInterval();
  }

  /**
   * Send a message to Claude Code
   */
  async sendMessage(message: string): Promise<Message[]> {
    if (!this.currentConversation) {
      throw new Error('No active conversation');
    }

    // Send via IPC
    const result = await ipc.claudeSend(
      this.currentConversation,
      this.currentProject || '',
      message,
      'talk'
    );

    if (!result.messageId) {
      throw new Error(`Failed to send message`);
    }

    return [];
  }

  /**
   * Process incoming Claude stream
   */
  async processStream(data: any): Promise<Message[]> {
    const result = messageReducer(this.state, [data], null);

    if (result.permissions.length > 0) {
      // Handle permissions - send to chat
      for (const perm of result.permissions) {
        // Track permission with conversation context
        if (this.currentConversation) {
          this.state.pendingPermissions.set(perm.permission.id, {
            ...perm.permission,
            conversationId: this.currentConversation,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.permissionTimeoutMs
          } as any);
        }
        await this.sendPermissionNotification(perm);
      }
    }

    return result.newMessages;
  }

  /**
   * Send permission notification to chat
   */
  private async sendPermissionNotification(permission: PermissionMessage): Promise<void> {
    // Get the bot manager instance
    const botManager = (await import('../index')).botManager;
    if (!botManager) {
      console.error('Bot manager not available');
      return;
    }

    // Format permission message
    const text = this.formatPermissionMessage(permission);

    // Send via appropriate adapter
    await botManager.sendMessage(this.platform, 'default', text);
  }

  /**
   * Respond to permission request
   */
  async respondToPermission(permissionId: string, decision: 'approve' | 'deny'): Promise<void> {
    // Get permission data with conversation context
    const permData = this.state.pendingPermissions.get(permissionId) as unknown as PendingPermissionData;

    if (!permData) {
      console.error(`Permission ${permissionId} not found or expired`);
      return;
    }

    // Check if permission has expired
    if (Date.now() > permData.expiresAt) {
      console.error(`Permission ${permissionId} has expired`);
      this.state.pendingPermissions.delete(permissionId);
      return;
    }

    // Update local state
    const perm = this.state.pendingPermissions.get(permissionId);
    if (perm) {
      perm.status = decision === 'approve' ? 'approved' : 'denied';
      perm.decision = decision === 'approve' ? 'approved' : 'denied';
      perm.completedAt = Date.now();
    }

    // Send to Claude Code via IPC with conversationId
    const choice = decision === 'approve' ? 'yes' : 'no';
    await ipc.respondPermission(permData.conversationId, choice);

    // Remove from pending after responding
    this.state.pendingPermissions.delete(permissionId);
  }

  /**
   * Get pending permissions with conversation context
   */
  getPendingPermissions(): Array<{ id: string; data: PendingPermissionData }> {
    const now = Date.now();
    const pending: Array<{ id: string; data: PendingPermissionData }> = [];

    this.state.pendingPermissions.forEach((perm, id) => {
      const permData = perm as unknown as PendingPermissionData;
      if (permData.expiresAt > now) {
        pending.push({ id, data: permData });
      }
    });

    return pending.sort((a, b) => a.data.createdAt - b.data.createdAt);
  }

  /**
   * Start cleanup interval for expired permissions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      this.state.pendingPermissions.forEach((perm, id) => {
        const permData = perm as unknown as PendingPermissionData;
        if (permData.expiresAt && permData.expiresAt < now) {
          this.state.pendingPermissions.delete(id);
          cleaned++;
        }
      });

      if (cleaned > 0) {
        console.log(`[ClaudeIntegration] Cleaned up ${cleaned} expired permissions`);
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Cleanup method to stop intervals (for shutdown)
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get messages for display
   */
  getMessages(limit?: number): Message[] {
    const allMessages = Array.from(this.state.messages.values());
    const sorted = allMessages.sort((a, b) => a.timestamp - b.timestamp);

    if (limit) {
      return sorted.slice(-limit);
    }

    return sorted;
  }

  /**
   * Set current conversation
   */
  setConversation(conversationId: string, projectPath: string): void {
    this.currentConversation = conversationId;
    this.currentProject = projectPath;
  }

  /**
   * Get current conversation info
   */
  getCurrentConversation(): { id: string; projectPath: string } | null {
    if (!this.currentConversation || !this.currentProject) {
      return null;
    }
    return {
      id: this.currentConversation,
      projectPath: this.currentProject,
    };
  }

  /**
   * Format permission message for chat
   */
  private formatPermissionMessage(permission: PermissionMessage): string {
    const tool = permission.permission;
    let text = `🔔 权限请求\n\n`;
    text += `工具: ${tool.toolName}\n`;

    // Format input briefly
    const input = JSON.stringify(tool.input);
    const shortInput = input.length > 100 ? input.substring(0, 100) + '...' : input;
    text += `详情: ${shortInput}\n\n`;

    text += `回复 /approve 批准\n`;
    text += `回复 /deny 拒绝`;

    return text;
  }
}

// Global integration instance (will be initialized per platform)
export const whatsappIntegration = new ClaudeIntegration('whatsapp');
export const feishuIntegration = new ClaudeIntegration('feishu');
