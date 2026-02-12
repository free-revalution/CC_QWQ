/**
 * Message Reducer for Bot Integration
 *
 * Based on Happy's 5-phase reducer architecture:
 * - Phase 0: Permission handling
 * - Phase 1: User and text messages
 * - Phase 2: Tool calls
 * - Phase 3: Tool results
 * - Phase 4: Sidechains (simplified)
 * - Phase 5: Events
 */
import type { ReducerState, ReducerResult } from '../types/reducer';
export interface ClaudeRawMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    timestamp: number;
    content: unknown[];
    type?: 'text' | 'tool_call' | 'tool_result' | 'permission_request' | 'event';
    localId?: string;
}
/**
 * Main reducer function - processes raw messages through all phases
 */
export declare function messageReducer(state: ReducerState, rawMessages: ClaudeRawMessage[], agentState?: unknown): ReducerResult;
/**
 * Create a new reducer state
 */
export declare function createReducerState(): ReducerState;
