/**
 * Tool View Formatter Registry
 *
 * Based on Happy's tool view system, each tool has a dedicated formatter
 * that generates appropriate display text for chat platforms.
 */

import type { ToolCallMessage, BashToolInput, BashToolResult, EditToolInput, WriteToolInput, TodoWriteToolInput } from '../types/messages';

// Type assertion for Bash tool input
function asBashInput(input: Record<string, unknown> | undefined): BashToolInput | undefined {
  return input as BashToolInput | undefined;
}

// Type assertion for Edit tool input
function asEditInput(input: Record<string, unknown> | undefined): EditToolInput | undefined {
  return input as EditToolInput | undefined;
}

// Type assertion for Write tool input
function asWriteInput(input: Record<string, unknown> | undefined): WriteToolInput | undefined {
  return input as WriteToolInput | undefined;
}

// Type assertion for TodoWrite tool input
function asTodoWriteInput(input: Record<string, unknown> | undefined): TodoWriteToolInput | undefined {
  return input as TodoWriteToolInput | undefined;
}

// Type assertion for Bash tool result
function asBashResult(result: unknown): BashToolResult | undefined {
  return result as BashToolResult | undefined;
}

export interface ToolViewFormatter {
  // Generate summary for chat display (brief)
  formatSummary(tool: ToolCallMessage['tool']): string;

  // Generate state change notification
  formatStateChange(tool: ToolCallMessage['tool']): string;

  // Generate detailed output (for desktop or /full command)
  formatDetail(tool: ToolCallMessage['tool']): string;

  // Check if this tool needs desktop handling for complex operations
  needsDesktopHandling?(tool: ToolCallMessage['tool']): boolean;

  // Check if output should be truncated in chat
  shouldTruncate?(tool: ToolCallMessage['tool'], outputLength: number): boolean;

  // Extract key information for summaries
  extractKeyInfo?(tool: ToolCallMessage['tool']): Record<string, unknown>;
}

// Bash tool formatter
const bashFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    const input = asBashInput(tool.input);
    const cmd = input?.command ?? input?.cmd ?? '';
    const shortCmd = cmd.length > 40 ? cmd.substring(0, 40) + '...' : cmd;
    return `🔧 Bash: ${shortCmd}`;
  },

  formatStateChange: (tool) => {
    switch (tool.state) {
      case 'running':
        return `⏳ Bash 运行中... [${formatDuration(tool.startedAt)}]`;
      case 'completed':
        return `✅ Bash 完成 ${tool.completedAt ? `[${formatDuration(tool.createdAt, tool.completedAt)}]` : ''}`;
      case 'error': {
        const result = asBashResult(tool.result);
        return `❌ Bash 错误: ${result?.error ?? '执行失败'}`;
      }
      default:
        return `🔧 Bash: ${asBashInput(tool.input)?.command ?? ''}`;
    }
  },

  formatDetail: (tool) => {
    const input = asBashInput(tool.input);
    const cmd = input?.command ?? input?.cmd ?? '';
    let output = `🔧 Bash 命令执行\n`;
    output += `命令: ${cmd}\n\n`;

    if (tool.state === 'running') {
      output += `状态: 运行中...\n`;
      output += `开始时间: ${new Date(tool.startedAt ?? tool.createdAt).toLocaleString()}\n`;
    } else if (tool.state === 'completed') {
      output += `状态: ✅ 完成\n`;
      if (tool.completedAt) {
        output += `完成时间: ${new Date(tool.completedAt).toLocaleString()}\n`;
      }
      const result = asBashResult(tool.result);
      if (result?.exit_code !== undefined) {
        output += `退出码: ${result.exit_code}\n`;
      }
      if (result?.stdout) {
        output += `\n标准输出:\n${result.stdout}\n`;
      }
      if (result?.stderr) {
        output += `\n标准错误:\n${result.stderr}\n`;
      }
    } else if (tool.state === 'error') {
      output += `状态: ❌ 错误\n`;
      const result = asBashResult(tool.result);
      output += `错误: ${result?.error ?? '未知错误'}\n`;
    }

    return output;
  },

  shouldTruncate: (_tool, outputLength) => {
    // Truncate bash output if very long
    return outputLength > 2000;
  }
};

// Edit/Str Replace tool formatter
const editFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    const input = asEditInput(tool.input);
    const path = input?.path ?? input?.file_path ?? '';
    const op = input?.command ?? 'edit';
    const shortPath = path.length > 30 ? '...' + path.substring(path.length - 30) : path;
    return `📝 ${op}: ${shortPath}`;
  },

  formatStateChange: (tool) => {
    const input = asEditInput(tool.input);
    const path = input?.path ?? '';
    switch (tool.state) {
      case 'running':
        return `⏳ 编辑 ${path}...`;
      case 'completed':
        return `✅ 编辑完成: ${path}`;
      case 'error':
        return `❌ 编辑失败: ${path}`;
      default:
        return `📝 ${input?.command ?? ''}: ${path}`;
    }
  },

  formatDetail: (tool) => {
    const input = asEditInput(tool.input);
    let output = `📝 文件编辑操作\n`;
    output += `操作: ${input?.command ?? ''}\n`;
    output += `文件: ${input?.path ?? ''}\n\n`;

    if (input?.old_str && input?.new_str) {
      output += `替换内容:\n`;
      output += `- 移除: ${input.old_str.substring(0, 100)}...\n`;
      output += `+ 添加: ${input.new_str.substring(0, 100)}...\n`;
    }

    if (tool.state === 'completed' && tool.result) {
      output += `\n结果: ${tool.result}\n`;
    }

    return output;
  }
};

// Write tool formatter
const writeFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    const input = asWriteInput(tool.input);
    const path = input?.path ?? '';
    const shortPath = path.length > 30 ? '...' + path.substring(path.length - 30) : path;
    return `📄 写入: ${shortPath}`;
  },

  formatStateChange: (tool) => {
    switch (tool.state) {
      case 'running':
        return `⏳ 写入文件...`;
      case 'completed':
        return `✅ 文件已写入`;
      case 'error':
        return `❌ 写入失败`;
      default: {
        const input = asWriteInput(tool.input);
        return `📄 写入: ${input?.path ?? ''}`;
      }
    }
  },

  formatDetail: (tool) => {
    const input = asWriteInput(tool.input);
    let output = `📄 文件写入\n`;
    output += `文件: ${input?.path ?? ''}\n`;

    if (input?.content) {
      const content = input.content;
      const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
      output += `\n内容预览:\n${preview}\n`;
    }

    return output;
  }
};

// TodoWrite tool formatter
const todoFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    const input = asTodoWriteInput(tool.input);
    const todos = input?.todos ?? [];
    return `📋 任务列表: ${todos.length} 项`;
  },

  formatStateChange: (tool) => {
    if (tool.state === 'completed') {
      return `✅ 任务列表已更新`;
    }
    return `📋 任务列表更新中...`;
  },

  formatDetail: (tool) => {
    const input = asTodoWriteInput(tool.input);
    const todos = input?.todos ?? [];

    let output = `任务数: ${todos.length}\n\n`;

    todos.forEach((todo: { status: string; priority: string; content: string }, idx: number) => {
      const status = todo.status === 'completed' ? '✅' :
                    todo.status === 'in_progress' ? '🔄' : '⬜';
      const priority = todo.priority === 'high' ? '🔴' :
                       todo.priority === 'medium' ? '🟡' : '🟢';
      output += `${idx + 1}. ${status} ${priority} ${todo.content}\n`;
    });

    return output;
  },

  extractKeyInfo: (tool) => {
    const input = asTodoWriteInput(tool.input);
    const todos = input?.todos ?? [];
    return {
      todoCount: todos.length,
      completed: todos.filter((t: { status: string; priority: string; content: string }) => t.status === 'completed').length
    };
  }
};

// Task tool formatter (subagent)
const taskFormatter: ToolViewFormatter = {
  formatSummary: () => {
    return `🎯 子任务启动`;
  },

  formatStateChange: (tool) => {
    if (tool.state === 'running') {
      return `🎯 子任务运行中...`;
    }
    return `🎯 子任务`;
  },

  formatDetail: (tool) => {
    let output = `🎯 Task 子任务\n`;
    output += `目标: ${(tool.input?.goal ?? tool.description ?? '') as string}\n\n`;
    output += `⚠️ 复杂任务，建议在桌面端查看完整对话\n`;
    return output;
  },

  needsDesktopHandling: () => {
    // Task tools are complex, recommend desktop
    return true;
  }
};

// MCP tool formatter (generic)
const mcpFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    const parts = tool.name.split('/');
    const server = parts[0] ?? 'mcp';
    const toolName = parts[1] ?? tool.name;
    return `🔌 MCP: ${server}.${toolName}`;
  },

  formatStateChange: (tool) => {
    return `${formatToolForChat(tool)}: ${tool.state}`;
  },

  formatDetail: (tool) => {
    let output = `🔌 MCP 工具调用\n`;
    output += `工具: ${tool.name}\n`;
    output += `输入: ${JSON.stringify(tool.input, null, 2)}\n`;

    if (tool.result) {
      output += `\n结果:\n${JSON.stringify(tool.result, null, 2)}\n`;
    }

    return output;
  }
};

// Default formatter for unknown tools
const defaultFormatter: ToolViewFormatter = {
  formatSummary: (tool) => {
    return `🔧 ${tool.name}`;
  },

  formatStateChange: (tool) => {
    const statusIcon = tool.state === 'running' ? '⏳' :
                       tool.state === 'completed' ? '✅' :
                       tool.state === 'error' ? '❌' : '🔧';
    return `${statusIcon} ${tool.name}`;
  },

  formatDetail: (tool) => {
    let output = `🔧 ${tool.name}\n`;
    output += `状态: ${tool.state}\n`;
    output += `输入: ${JSON.stringify(tool.input, null, 2)}\n`;

    if (tool.result) {
      output += `\n结果:\n${JSON.stringify(tool.result, null, 2)}\n`;
    }

    return output;
  }
};

// Tool registry
export const toolViewRegistry: Record<string, ToolViewFormatter> = {
  // Exact matches
  'bash:execute': bashFormatter,
  'str_replace_editor': editFormatter,
  'write': writeFormatter,
  'edit': editFormatter,
  'TodoWrite': todoFormatter,
  'Task': taskFormatter,

  // Generic MCP handler (catches MCP tools)
  '_mcp_tool': mcpFormatter,

  // Default fallback
  '_default': defaultFormatter
};

/**
 * Get formatter for a tool
 */
export function getToolFormatter(toolName: string): ToolViewFormatter {
  // Exact match first
  if (toolViewRegistry[toolName]) {
    return toolViewRegistry[toolName];
  }

  // MCP tools contain '/'
  if (toolName.includes('/')) {
    return toolViewRegistry['_mcp_tool'];
  }

  // Fallback
  return toolViewRegistry['_default'];
}

/**
 * Format tool for chat display
 */
export function formatToolForChat(tool: ToolCallMessage['tool']): string {
  const formatter = getToolFormatter(tool.name);
  return formatter.formatSummary(tool);
}

/**
 * Format tool state change for notification
 */
export function formatToolStateChange(tool: ToolCallMessage['tool']): string {
  const formatter = getToolFormatter(tool.name);
  return formatter.formatStateChange(tool);
}

/**
 * Format tool detail (for /full command or desktop)
 */
export function formatToolDetail(tool: ToolCallMessage['tool']): string {
  const formatter = getToolFormatter(tool.name);
  return formatter.formatDetail(tool);
}

/**
 * Check if tool needs desktop handling
 */
export function needsDesktopHandling(tool: ToolCallMessage['tool']): boolean {
  const formatter = getToolFormatter(tool.name);
  return formatter.needsDesktopHandling?.(tool) ?? false;
}

/**
 * Check if output should be truncated
 */
export function shouldTruncateOutput(tool: ToolCallMessage['tool'], outputLength: number): boolean {
  const formatter = getToolFormatter(tool.name);
  return formatter.shouldTruncate?.(tool, outputLength) ?? false;
}

/**
 * Extract key info from tool
 */
export function extractToolKeyInfo(tool: ToolCallMessage['tool']): Record<string, unknown> | null {
  const formatter = getToolFormatter(tool.name);
  return formatter.extractKeyInfo?.(tool) ?? null;
}

//
// Helper functions
//

function formatDuration(start: number | undefined, end?: number): string {
  if (!start) return '';
  const startTime = new Date(start);
  const endTime = end ? new Date(end) : new Date();
  const diff = endTime.getTime() - startTime.getTime();

  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  return `${Math.floor(diff / 60000)}m`;
}
