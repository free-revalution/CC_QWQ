import { describe, it, expect } from 'vitest'
import { createReducer, type ReducerState } from './reducer'

describe('Reducer State', () => {
  describe('createReducer', () => {
    it('should create empty state with all maps initialized', () => {
      const state = createReducer()

      expect(state.localIds).toBeInstanceOf(Map)
      expect(state.localIds.size).toBe(0)

      expect(state.messageIds).toBeInstanceOf(Map)
      expect(state.messageIds.size).toBe(0)

      expect(state.toolIdToMessageId).toBeInstanceOf(Map)
      expect(state.toolIdToMessageId.size).toBe(0)

      expect(state.pendingPermissions).toBeInstanceOf(Map)
      expect(state.pendingPermissions.size).toBe(0)

      expect(state.sidechains).toBeInstanceOf(Map)
      expect(state.sidechains.size).toBe(0)

      expect(state.messages).toBeInstanceOf(Map)
      expect(state.messages.size).toBe(0)
    })

    it('should initialize metrics with zero values', () => {
      const state = createReducer()

      expect(state.metrics.messagesProcessed).toBe(0)
      expect(state.metrics.errors).toBe(0)
      expect(state.metrics.lastUpdate).toBeGreaterThan(0)
    })

    it('should create independent state instances', () => {
      const state1 = createReducer()
      const state2 = createReducer()

      state1.messageIds.set('test', 'test')

      expect(state1.messageIds.size).toBe(1)
      expect(state2.messageIds.size).toBe(0)
    })
  })
})
