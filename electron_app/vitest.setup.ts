import { vi } from 'vitest'

// Mock IPC
vi.mock('@/lib/ipc', () => ({
  ipc: {
    claudeSend: vi.fn(),
    respondPermission: vi.fn(),
    getMessages: vi.fn()
  }
}))
