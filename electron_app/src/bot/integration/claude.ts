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

export class ClaudeIntegration {
  private state: ReducerState;
  private currentConversation: string | null = null;
  private currentProject: string | null = null;
  private platform: 'whatsapp' | 'feishu';

  constructor(platform: 'whatsapp' | 'feishu') {
    this.platform = platform;
    this.state = createReducerState();
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
    const botManager = (window as any).botManager;
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
    // Update local state
    const perm = this.state.pendingPermissions.get(permissionId);
    if (perm) {
      perm.status = decision === 'approve' ? 'approved' : 'denied';
      perm.decision = decision === 'approve' ? 'approved' : 'denied';
    }

    // Send to Claude Code via IPC
    const choice = decision === 'approve' ? 'yes' : 'no';
    await ipc.respondPermission(permissionId, choice);
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
