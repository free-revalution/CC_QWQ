/**
 * 用于定义机器人在不同平台上的消息和通知类型
 */

// 定义机器人消息类型
export interface BotMessage {
  platform: 'whatsapp' | 'feishu'; // 消息来源平台
  userId: string; // 消息发送用户ID
  chatId: string; // 消息发送聊天ID
  content: string; // 消息内容
  timestamp: number; // 消息发送时间戳
}

// 定义机器人通知类型
export interface BotNotification {
  type: 'info' | 'success' | 'warning' | 'error'; // 通知类型
  title: string; // 通知标题
  message: string; // 通知消息内容
  actions?: Array<{
    label: string; // 操作按钮标签
    command: string; // 操作按钮触发的命令
  }>;
}

// 定义命令上下文类型
export interface CommandContext {
  message: BotMessage; // 命令触发的消息
  platform: 'whatsapp' | 'feishu'; // 命令触发平台
  args: string[]; // 命令参数
  conversationId?: string; // 会话ID（可选）
  projectPath?: string; // 项目路径（可选）
  ipc?: typeof import('../lib/ipc').ipc; // IPC 模块（可选）  
}

// 定义命令执行结果类型
export interface CommandResult {
  success: boolean; // 是否执行成功
  message: string; // 执行结果消息
  data?: unknown; // 执行结果数据（可选）
}

// 定义机器人指标类型
export interface BotMetrics {
  whatsappConnected: boolean; // 是否已连接WhatsApp
  feishuConnected: boolean; // 是否已连接飞书
  messagesReceived: number; // 接收消息数量
  messagesSent: number; // 发送消息数量
  averageResponseTime: number; // 平均响应时间（毫秒）
  errorCount: number; // 错误次数
  lastErrorTime: number; // 最后一次错误时间戳
}
