/**
 * Conversation and Context Management
 */
import type { Message } from './messages';
export interface ConversationContext {
    id: string;
    projectPath: string;
    createdAt: number;
    lastActive: number;
    messageCount: number;
    summary?: string;
    recentTools?: string[];
    maxMessages?: number;
    maxContextTokens?: number;
}
export interface ConversationManager {
    getCurrent(): ConversationContext | null;
    switch(conversationId: string): Promise<void>;
    create(projectPath: string): ConversationContext;
    getHistory(conversationId: string, limit?: number): Message[];
    getAll(): ConversationContext[];
}
export interface MessageSummary {
    id: string;
    kind: string;
    timestamp: number;
    summary: string;
    toolName?: string;
    toolState?: string;
}
