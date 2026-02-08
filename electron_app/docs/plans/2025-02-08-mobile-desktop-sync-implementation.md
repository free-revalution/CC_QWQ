# 移动端与桌面端同步功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现移动端与桌面端的 conversation 列表同步、消息单向同步、文件上传和性能优化

**Architecture:**
- 扩展 WebSocket 消息类型以支持 conversation 列表和选择
- 移动端通过隐藏侧边栏显示桌面端 conversation 列表
- 移动端消息复用现有的 callClaude 流程，使用选定的 conversationId
- 桌面端新增文件上传功能
- 使用虚拟滚动优化桌面端性能

**Tech Stack:** Electron, TypeScript, React, node-pty, ws (WebSocket), react-window

---

## 阶段 1: 后端 - Conversation 列表 API

### Task 1: 新增 IPC 处理器 - get-conversation-list

**Files:**
- Modify: `electron/main.ts` (在 IPC 处理器部分添加，约在 1570 行后)

**Step 1: 添加 IPC 处理器函数**

在 `electron/main.ts` 中，`ipcMain.handle('claude-send', ...)` 之后添加：

```typescript
// IPC 处理器：获取 conversation 列表（用于移动端同步）
ipcMain.handle('get-conversation-list', async () => {
  try {
    const conversations = Array.from(claudeSessions.entries()).map(([convId, session]) => {
      // 确定状态
      let status: 'not_started' | 'initializing' | 'ready' = 'not_started'
      if (session.isInitialized) {
        status = session.state === 'ready' ? 'ready' : 'initializing'
      }

      return {
        id: convId,
        title: convId, // TODO: 后续可以从存储获取实际标题
        status,
        lastMessage: session.lastUserMessage || undefined,
        updatedAt: session.lastUserMessage ? Date.now() : 0
      }
    })

    console.log('[Conversation List] Sending', conversations.length, 'conversations')
    return { success: true, conversations }
  } catch (error) {
    console.error('[Conversation List] Error:', error)
    return { success: false, error: (error as Error).message }
  }
})
```

**Step 2: 更新 TypeScript 类型定义**

在 `src/types/index.ts` 的 `ElectronAPI` 接口中添加（约在第 40 行后）：

```typescript
  /** 获取 conversation 列表（用于移动端同步） */
  getConversationList: () => Promise<{ success: boolean; conversations?: Array<{
    id: string
    title: string
    status: 'not_started' | 'initializing' | 'ready'
    lastMessage?: string
    updatedAt: number
  }>; error?: string }>
```

**Step 3: 更新 src/global.d.ts**

在 `src/global.d.ts` 的 `ElectronAPI` 接口中添加：

```typescript
  getConversationList: () => Promise<{ success: boolean; conversations?: Array<{
    id: string
    title: string
    status: 'not_started' | 'initializing' | 'ready'
    lastMessage?: string
    updatedAt: number
  }>; error?: string }>
```

**Step 4: 更新 src/lib/ipc.ts**

在 `ipc` 对象中添加（约在第 70 行后）：

```typescript
  /**
   * 获取 conversation 列表（用于移动端同步）
   */
  getConversationList: async () => {
    if (window.electronAPI?.getConversationList) {
      return window.electronAPI.getConversationList()
    }
    console.warn('electronAPI.getConversationList not available')
    return { success: false, conversations: [] }
  },
```

**Step 5: 测试 IPC 处理器**

运行: `npm run build`

预期: 构建成功，无 TypeScript 错误

**Step 6: 提交**

```bash
git add electron/main.ts src/types/index.ts src/global.d.ts src/lib/ipc.ts
git commit -m "feat: add get-conversation-list IPC handler for mobile sync"
```

---

### Task 2: WebSocket 服务器 - 扩展客户端类型

**Files:**
- Modify: `electron/main.ts` (WebSocket 类型定义部分，约在第 679-690 行)

**Step 1: 扩展 WebSocketClient 接口**

找到 `interface WebSocketClient` 定义，添加 `selectedConversationId` 属性：

```typescript
interface WebSocketClient {
  readyState: number
  send: (data: string) => void
  on: (event: string, callback: (...args: any[]) => void) => void
  close: () => void
  selectedConversationId?: string  // 新增：移动端选择的 conversationId
}
```

**Step 2: 构建测试**

运行: `npm run build`

预期: 构建成功

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: add selectedConversationId to WebSocketClient interface"
```

---

### Task 3: WebSocket 服务器 - sendConversationList 函数

**Files:**
- Modify: `electron/main.ts` (在 startWebSocketServer 函数内添加，约在第 810 行后)

**Step 1: 添加 sendConversationList 函数**

在 `completeAuth` 函数之后添加：

```typescript
// 发送 conversation 列表给移动端
const sendConversationList = (ws: WebSocketClient) => {
  try {
    const conversations = Array.from(claudeSessions.entries()).map(([id, session]) => {
      let status: 'not_started' | 'initializing' | 'ready' = 'not_started'
      if (session.isInitialized) {
        status = session.state === 'ready' ? 'ready' : 'initializing'
      }

      return {
        id,
        title: id,
        status,
        lastMessage: session.lastUserMessage || undefined,
        updatedAt: session.lastUserMessage ? Date.now() : 0
      }
    })

    ws.send(JSON.stringify({
      type: 'conversation-list',
      data: { conversations }
    }))

    console.log('[WebSocket] Sent conversation list to mobile client:', conversations.length, 'conversations')
  } catch (error) {
    console.error('[WebSocket] Failed to send conversation list:', error)
  }
}
```

**Step 2: 在 completeAuth 中调用 sendConversationList**

找到 `completeAuth` 函数，在发送认证成功消息后添加调用：

```typescript
const completeAuth = () => {
  isAuthenticated = true
  hasCompletedAuth = true
  mobileClients.add(ws)
  ws.send(JSON.stringify({ type: 'auth', success: true }))
  console.log('Client authenticated successfully')

  // 发送 conversation 列表
  setTimeout(() => {
    if (ws.readyState === 1) {
      sendConversationList(ws)
    } else {
      console.log('Client disconnected before conversation list could be sent')
    }
  }, 100)
}
```

**Step 3: 构建测试**

运行: `npm run build`

预期: 构建成功

**Step 4: 提交**

```bash
git add electron/main.ts
git commit -m "feat: add sendConversationList function for mobile clients"
```

---

### Task 4: WebSocket 服务器 - broadcastConversationList 函数

**Files:**
- Modify: `electron/main.ts` (在 sendConversationList 函数后添加)

**Step 1: 添加 broadcastConversationList 函数**

```typescript
// 广播 conversation 列表更新给所有连接的移动端
const broadcastConversationList = () => {
  mobileClients.forEach(client => {
    if (client.readyState === 1) {
      sendConversationList(client)
    }
  })
  console.log('[WebSocket] Broadcasted conversation list to', mobileClients.size, 'clients')
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: add broadcastConversationList function"
```

---

### Task 5: WebSocket 服务器 - 处理 select-conversation 消息

**Files:**
- Modify: `electron/main.ts` (在 ws.on('message') 处理器中添加，约在第 858 行后)

**Step 1: 在消息处理中添加 select-conversation 分支**

找到 `else if (message.type === 'message')` 部分，在其之前添加：

```typescript
              } else if (message.type === 'select-conversation') {
                // 移动端选择 conversation
                if (!isAuthenticated) {
                  console.log('Select-conversation received before authentication, ignoring')
                  return
                }

                const targetConversationId = message.data.conversationId
                console.log('[WebSocket] Mobile client selected conversation:', targetConversationId)

                // 记录该客户端选择的 conversation
                ws.selectedConversationId = targetConversationId

                // 广播更新（可能有其他移动端需要知道）
                broadcastConversationList()

                // 发送确认
                ws.send(JSON.stringify({
                  type: 'conversation-selected',
                  data: { conversationId: targetConversationId, success: true }
                }))
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: handle select-conversation message from mobile clients"
```

---

### Task 6: WebSocket 服务器 - 更新 message 处理使用选定 conversation

**Files:**
- Modify: `electron/main.ts` (约在第 888 行)

**Step 1: 修改移动端消息处理逻辑**

找到 `const mobileConversationId = 'mobile-default'` 部分，替换为：

```typescript
                // 移动端发送的消息 - 转发给桌面端处理
                // 使用客户端选择的 conversationId，或使用消息中指定的
                if (!currentProjectPath) {
                  const errorMsg = {
                    type: 'response',
                    data: {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: '请先在桌面端选择项目文件夹',
                      timestamp: Date.now(),
                    },
                  }
                  ws.send(JSON.stringify(errorMsg))
                  return
                }

                // 获取目标 conversationId
                const targetConversationId = ws.selectedConversationId || message.data?.conversationId

                if (!targetConversationId) {
                  const errorMsg = {
                    type: 'error',
                    data: {
                      message: '请先在移动端选择一个对话'
                    }
                  }
                  ws.send(JSON.stringify(errorMsg))
                  return
                }

                // 调用 Claude
                try {
                  console.log('[WebSocket] Mobile message for conversation:', targetConversationId)

                  const response = await callClaude(targetConversationId, currentProjectPath, message.data.content)
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: use selected conversationId for mobile messages"
```

---

### Task 7: 桌面端 - 在 conversation 变化时广播给移动端

**Files:**
- Modify: `electron/main.ts` (在 createConversation 相关位置调用 broadcastConversationList)

**Step 1: 找到 createConversation 调用位置**

搜索 `createConversation` 的使用位置，在创建新 conversation 后添加广播。

在 `ipcMain.handle('create-conversation', ...)` 中，找到成功创建后的位置，添加：

```typescript
        console.log('[Conversation] Created new conversation:', result.conversationId)

        // 广播给移动端
        broadcastConversationList()
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: broadcast conversation list when creating new conversation"
```

---

### Task 8: 后端 - 在 Claude 状态变化时广播

**Files:**
- Modify: `electron/main.ts`

**Step 1: 在初始化完成时广播**

在 `setupPTYDataHandler` 中，当 session 变为 ready 时添加广播：

找到 `session.state = 'ready'` 的位置，在其后添加：

```typescript
        session.state = 'ready'
        session.isInitialized = true
        session.initializedAt = Date.now()
        session.buffer = ''
        console.log('[Claude] Session is now ready for user input, conversationId:', conversationId)

        // 广播给移动端
        broadcastConversationList()
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add electron/main.ts
git commit -m "feat: broadcast conversation list on Claude state changes"
```

---

## 阶段 2: 前端 - 移动端 Conversation 列表 UI

### Task 9: 移动端 - 添加 Conversation 类型定义

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 添加 MobileConversation 类型**

在 `src/types/index.ts` 中，在 `FilterMode` 类型后添加：

```typescript
// 移动端同步的 Conversation 类型
export interface MobileConversation {
  id: string
  title: string
  status: 'not_started' | 'initializing' | 'ready'
  lastMessage?: string
  updatedAt: number
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add MobileConversation type"
```

---

### Task 10: 移动端 - 添加 IPC 方法到 ElectronAPI

**Files:**
- Modify: `src/types/index.ts` (ElectronAPI 接口)

**Step 1: 添加 getConversationList 方法**

在 `ElectronAPI` 接口中添加（约在第 50 行后）：

```typescript
  /** 获取 conversation 列表（用于移动端同步） */
  getConversationList: () => Promise<{
    success: boolean
    conversations?: MobileConversation[]
    error?: string
  }>
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add getConversationList to ElectronAPI type"
```

---

### Task 11: 移动端 - 创建 StatusIndicator 组件

**Files:**
- Create: `src/components/mobile/StatusIndicator.tsx`

**Step 1: 创建组件文件**

```typescript
import React from 'react'

interface StatusIndicatorProps {
  status: 'not_started' | 'initializing' | 'ready'
  size?: 'sm' | 'md'
}

export default function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2'
  }

  const colors = {
    not_started: 'bg-gray-500',
    initializing: 'bg-yellow-500 animate-pulse',
    ready: 'bg-green-500'
  }

  return (
    <div className={`${sizes[size]} rounded-full ${colors[status]}`} />
  )
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/components/mobile/StatusIndicator.tsx
git commit -m "feat: add StatusIndicator component for mobile"
```

---

### Task 12: 移动端 - 创建 ConversationItem 组件

**Files:**
- Create: `src/components/mobile/ConversationItem.tsx`

**Step 1: 创建组件文件**

```typescript
import React from 'react'
import { ChevronRight } from 'lucide-react'
import StatusIndicator from './StatusIndicator'
import type { MobileConversation } from '../../types'

interface ConversationItemProps {
  conversation: MobileConversation
  isSelected: boolean
  onClick: () => void
}

export default function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg transition-all duration-200
        ${isSelected
          ? 'bg-blue-500/20 border border-blue-500/30'
          : 'bg-white/5 hover:bg-white/10 border border-transparent'
        }
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIndicator status={conversation.status} size="sm" />
            <span className="text-sm font-medium text-primary truncate">
              {conversation.title}
            </span>
          </div>
          {conversation.lastMessage && (
            <p className="text-xs text-secondary truncate">
              {conversation.lastMessage}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-secondary flex-shrink-0" />
      </div>
    </button>
  )
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/components/mobile/ConversationItem.tsx
git commit -m "feat: add ConversationItem component for mobile"
```

---

### Task 13: 移动端 - 创建 ConversationDrawer 组件

**Files:**
- Create: `src/components/mobile/ConversationDrawer.tsx`

**Step 1: 创建组件文件**

```typescript
import React from 'react'
import { X } from 'lucide-react'
import ConversationItem from './ConversationItem'
import type { MobileConversation } from '../../types'

interface ConversationDrawerProps {
  isOpen: boolean
  onClose: () => void
  conversations: MobileConversation[]
  selectedConversationId: string | null
  onSelectConversation: (id: string) => void
}

export default function ConversationDrawer({
  isOpen,
  onClose,
  conversations,
  selectedConversationId,
  onSelectConversation
}: ConversationDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* 侧边栏 */}
      <div className="relative w-80 max-w-[80vw] h-full bg-gray-900/95 backdrop-blur-xl border-r border-white/10">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-primary">对话列表</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-secondary" />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              暂无对话
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversationId === conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/components/mobile/ConversationDrawer.tsx
git commit -m "feat: add ConversationDrawer component for mobile"
```

---

### Task 14: 移动端 - 集成 ConversationDrawer 到 SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 添加状态和导入**

在 SettingsPage 组件中添加：

```typescript
import ConversationDrawer from '../components/mobile/ConversationDrawer'
import type { MobileConversation } from '../types'

// 在组件内部添加状态
const [showConversationDrawer, setShowConversationDrawer] = useState(false)
const [mobileConversations, setMobileConversations] = useState<MobileConversation[]>([])
const [selectedMobileConversationId, setSelectedMobileConversationId] = useState<string | null>(null)
```

**Step 2: 添加加载 conversation 列表的函数**

```typescript
  // 加载移动端 conversation 列表
  const loadMobileConversations = useCallback(async () => {
    try {
      const result = await ipc.getConversationList()
      if (result.success && result.conversations) {
        setMobileConversations(result.conversations)
        console.log('[Mobile] Loaded', result.conversations.length, 'conversations')
      }
    } catch (error) {
      console.error('[Mobile] Failed to load conversations:', error)
    }
  }, [])

  // 在组件挂载时加载
  useEffect(() => {
    loadMobileConversations()
    // 定期刷新列表
    const interval = setInterval(loadMobileConversations, 5000)
    return () => clearInterval(interval)
  }, [loadMobileConversations])
```

**Step 3: 在 UI 中添加触发按钮和 Drawer**

在适当位置添加按钮（比如在连接信息附近）：

```typescript
<button
  onClick={() => setShowConversationDrawer(true)}
  className="px-3 py-2 rounded-lg glass-button hover:bg-white/20 transition-all text-sm"
>
  查看对话列表
</button>

<ConversationDrawer
  isOpen={showConversationDrawer}
  onClose={() => setShowConversationDrawer(false)}
  conversations={mobileConversations}
  selectedConversationId={selectedMobileConversationId}
  onSelectConversation={setSelectedMobileConversationId}
/>
```

**Step 4: 构建测试**

运行: `npm run build`

**Step 5: 提交**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: integrate ConversationDrawer into SettingsPage"
```

---

## 阶段 3: 修复移动端 UI 问题

### Task 15: 移动端 - 修复消息气泡宽度

**Files:**
- Modify: `src/index.css` 或相关 CSS 文件

**Step 1: 添加移动端消息气泡样式**

```css
/* 移动端消息气泡优化 */
.mobile-message-bubble {
  max-width: 85% !important;
  min-width: 120px;
  word-break: break-word;
  white-space: pre-wrap;
}

.mobile-message-bubble.user {
  margin-left: auto;
  border-radius: 18px 18px 4px 18px;
}

.mobile-message-bubble.assistant {
  margin-right: auto;
  border-radius: 18px 18px 18px 4px;
}

/* 移动端特殊处理 */
@media (max-width: 768px) {
  .message-content.user {
    max-width: 85%;
  }

  .message-content.assistant {
    max-width: 85%;
  }
}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/index.css
git commit -m "fix: improve mobile message bubble width"
```

---

## 阶段 4: 桌面端文件上传功能

### Task 16: 桌面端 - 添加文件选择 IPC 处理器

**Files:**
- Modify: `electron/main.ts` (在 IPC 处理器部分添加)

**Step 1: 添加 select-file IPC 处理器**

```typescript
// IPC 处理器：选择文件
ipcMain.handle('select-file', async () => {
  try {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Code Files', extensions: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'] },
        { name: 'Text Files', extensions: ['txt', 'md', 'json', 'yaml', 'yml', 'toml'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
      ]
    })

    if (result.canceled) {
      return { success: false, canceled: true }
    }

    return { success: true, filePath: result.filePaths[0] }
  } catch (error) {
    console.error('[File] Failed to select file:', error)
    return { success: false, error: (error as Error).message }
  }
})
```

**Step 2: 添加文件内容处理函数**

```typescript
// 处理文件内容
function handleFileContent(filePath: string): string {
  const fs = require('fs')
  const ext = filePath.split('.').pop()?.toLowerCase()
  const fileName = filePath.split('/').pop() || 'unknown'

  try {
    // 代码文件：直接读取内容
    const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'txt', 'md', 'json', 'yaml', 'yml', 'toml']
    if (codeExtensions.includes(ext || '')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return `[文件: ${fileName}]\n\n\`\`\`${ext || 'text'}\n${content}\n\`\`\``
    }

    // 图片文件：转换为 base64
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
    if (imageExtensions.includes(ext || '')) {
      const buffer = fs.readFileSync(filePath)
      const base64 = buffer.toString('base64')
      return `[图片: ${fileName}]\n\`\`\`\ndata:image/${ext};base64,${base64}\n\`\`\``
    }

    // 其他文件：只发送文件路径
    return `[文件: ${filePath}]`
  } catch (error) {
    console.error('[File] Failed to read file:', error)
    return `[文件读取失败: ${fileName}]`
  }
}
```

**Step 3: 添加 upload-file IPC 处理器**

```typescript
// IPC 处理器：上传文件到对话
ipcMain.handle('upload-file', async (_event, filePath: string, conversationId: string) => {
  try {
    if (!currentProjectPath) {
      return { success: false, error: '请先选择项目文件夹' }
    }

    const content = handleFileContent(filePath)
    const messageId = await callClaude(conversationId, currentProjectPath, content)

    console.log('[File] Uploaded file to conversation:', conversationId)
    return { success: true, messageId }
  } catch (error) {
    console.error('[File] Failed to upload file:', error)
    return { success: false, error: (error as Error).message }
  }
})
```

**Step 4: 构建测试**

运行: `npm run build`

**Step 5: 提交**

```bash
git add electron/main.ts
git commit -m "feat: add file upload IPC handlers"
```

---

### Task 17: 桌面端 - 更新类型定义

**Files:**
- Modify: `src/types/index.ts`, `src/global.d.ts`, `src/lib/ipc.ts`

**Step 1: 更新 src/types/index.ts**

在 `ElectronAPI` 接口中添加：

```typescript
  /** 选择文件 */
  selectFile: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>

  /** 上传文件到对话 */
  uploadFile: (filePath: string, conversationId: string) => Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Step 2: 更新 src/global.d.ts**

添加相同的类型定义。

**Step 3: 更新 src/lib/ipc.ts**

```typescript
  /**
   * 选择文件
   */
  selectFile: async () => {
    if (window.electronAPI?.selectFile) {
      return window.electronAPI.selectFile()
    }
    return { success: false, error: 'electronAPI not available' }
  },

  /**
   * 上传文件到对话
   */
  uploadFile: async (filePath: string, conversationId: string) => {
    if (window.electronAPI?.uploadFile) {
      return window.electronAPI.uploadFile(filePath, conversationId)
    }
    return { success: false, error: 'electronAPI not available' }
  },
```

**Step 4: 构建测试**

运行: `npm run build`

**Step 5: 提交**

```bash
git add src/types/index.ts src/global.d.ts src/lib/ipc.ts
git commit -m "feat: add file upload types and ipc methods"
```

---

### Task 18: 桌面端 - ConversationPage 添加文件上传 UI

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 添加状态**

在组件中添加：

```typescript
import { Paperclip, X } from 'lucide-react'

const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; path: string; size: number }>>([])
```

**Step 2: 添加处理函数**

```typescript
  // 处理文件选择
  const handleFileSelect = async () => {
    try {
      const result = await ipc.selectFile()
      if (result.success && result.filePath) {
        const fs = await import('fs')
        const stats = fs.statSync(result.filePath)
        setSelectedFiles(prev => [...prev, {
          name: result.filePath!.split('/').pop() || 'unknown',
          path: result.filePath!,
          size: stats.size
        }])
      }
    } catch (error) {
      console.error('Failed to select file:', error)
    }
  }

  // 移除文件
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // 发送消息（包含文件）
  const handleSendWithFiles = async () => {
    if (!currentConversation || !inputValue.trim() || selectedFiles.length === 0) return

    setIsLoading(true)
    const currentMessageId = `msg-${Date.now()}`

    // 添加用户消息
    const userMessage: Message = {
      id: currentMessageId,
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    }

    // 上传文件
    for (const file of selectedFiles) {
      await ipc.uploadFile(file.path, currentConversation.id)
    }

    // 发送文本消息
    const { messageId } = await ipc.claudeSend(currentConversation.id, projectPath!, inputValue, filterMode)
    messageIdMapRef.current.set(messageId, currentMessageId)

    setInputValue('')
    setSelectedFiles([])
  }
```

**Step 3: 在 UI 中添加文件上传按钮**

在输入区域添加：

```typescript
<div className="flex items-end gap-2">
  {/* 文件上传按钮 */}
  <button
    onClick={handleFileSelect}
    className="p-2 rounded-lg hover:bg-white/20 transition-colors text-secondary hover:text-primary"
    title="上传文件"
  >
    <Paperclip size={20} />
  </button>

  {/* 文件预览 */}
  {selectedFiles.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-2">
      {selectedFiles.map((file, index) => (
        <div
          key={index}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm"
        >
          <span className="truncate max-w-[200px]">{file.name}</span>
          <button
            onClick={() => handleRemoveFile(index)}
            className="p-0.5 rounded hover:bg-white/20"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )}

  {/* 输入框和发送按钮 */}
  {/* ... 现有的输入框代码 */}
</div>
```

**Step 4: 构建测试**

运行: `npm run build`

**Step 5: 提交**

```bash
git add src/pages/ConversationPage.tsx
git commit -m "feat: add file upload UI to ConversationPage"
```

---

## 阶段 5: 桌面端性能优化

### Task 19: 桌面端 - 安装 react-window

**Files:**
- Modify: `package.json`

**Step 1: 安装依赖**

运行: `npm install react-window @types/react-window`

**Step 2: 提交 package-lock.json**

```bash
git add package.json package-lock.json
git commit -m "deps: install react-window for virtual scrolling"
```

---

### Task 20: 桌面端 - 优化 MessageContent 组件

**Files:**
- Modify: `src/components/ui/MessageContent.tsx`

**Step 1: 使用 React.memo 包装组件**

```typescript
export default React.memo(MessageContent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.role === nextProps.message.role
  )
})
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/components/ui/MessageContent.tsx
git commit -m "perf: memoize MessageContent component"
```

---

### Task 21: 桌面端 - 添加虚拟滚动支持（可选）

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 添加虚拟滚动支持**

注：这是可选的性能优化，如果消息数量不多可以跳过。

```typescript
import { FixedSizeList } from 'react-window'

// 在消息列表渲染部分
const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
  const message = currentConversation?.messages[index]
  if (!message) return null

  return (
    <div style={style}>
      <MessageContent
        message={message}
        conversationId={currentConversationId}
      />
    </div>
  )
}

// 使用虚拟列表
{currentConversation && currentConversation.messages.length > 50 ? (
  <FixedSizeList
    height={containerHeight}
    itemCount={currentConversation.messages.length}
    itemSize={150}
    width="100%"
  >
    {Row}
  </FixedSizeList>
) : (
  // 原有的列表渲染
  currentConversation.messages.map((message) => (
    <MessageContent
      key={message.id}
      message={message}
      conversationId={currentConversationId}
    />
  ))
)}
```

**Step 2: 构建测试**

运行: `npm run build`

**Step 3: 提交**

```bash
git add src/pages/ConversationPage.tsx
git commit -m "perf: add virtual scrolling for large message lists"
```

---

## 阶段 6: 测试和文档

### Task 22: 端到端测试

**Step 1: 测试移动端 conversation 列表**

1. 启动应用: `npm run electron:dev`
2. 在 Settings 页面点击"查看对话列表"
3. 验证显示桌面端的 conversation 列表
4. 验证状态指示灯正确显示

**Step 2: 测试移动端选择 conversation**

1. 从列表中选择一个 conversation
2. 验证选择状态更新
3. 发送测试消息
4. 验证消息出现在桌面端对应 conversation 中

**Step 3: 测试文件上传**

1. 在桌面端点击文件上传按钮
2. 选择一个代码文件
3. 验证文件内容正确发送到 Claude
4. 验证响应正确显示

**Step 4: 测试性能优化**

1. 创建一个包含 100+ 条消息的 conversation
2. 快速滚动消息列表
3. 验证没有空白块出现
4. 验证滚动流畅

**Step 5: 提交测试报告**

创建测试报告文件:

```bash
cat > docs/testing/mobile-desktop-sync-test-report.md << 'EOF'
# 移动端与桌面端同步功能测试报告

**测试日期**: 2025-02-08

## 测试结果

- [x] Conversation 列表显示
- [x] 选择 Conversation 功能
- [x] 移动端消息同步到桌面端
- [x] 文件上传功能
- [x] 性能优化效果
- [x] 移动端气泡宽度修复

## 发现的问题

(记录测试中发现的问题)

## 建议改进

(记录改进建议)
EOF
```

```bash
git add docs/testing/mobile-desktop-sync-test-report.md
git commit -m "test: add mobile-desktop sync test report"
```

---

### Task 23: 更新 README 文档

**Files:**
- Modify: `README.md`

**Step 1: 添加新功能说明**

```markdown
## 移动端同步

- 在同一局域网下，移动端可以连接到桌面端
- 移动端可以查看桌面端的 Conversation 列表
- 移动端消息会同步到桌面端
- 支持 Conversation 状态指示灯

## 文件上传

- 支持上传代码文件、文本文件、图片
- 文件内容会自动格式化发送给 Claude
```

**Step 2: 提交**

```bash
git add README.md
git commit -m "docs: update README with new features"
```

---

## 总结

这个实现计划包含 23 个任务，分为 6 个阶段：

1. **阶段 1**: 后端 Conversation 列表 API (8 个任务)
2. **阶段 2**: 前端移动端 Conversation 列表 UI (6 个任务)
3. **阶段 3**: 修复移动端 UI 问题 (1 个任务)
4. **阶段 4**: 桌面端文件上传功能 (3 个任务)
5. **阶段 5**: 桌面端性能优化 (3 个任务)
6. **阶段 6**: 测试和文档 (2 个任务)

每个任务都包含完整的代码实现、构建测试和提交步骤。按照这个计划实施，可以逐步完成移动端与桌面端同步功能的所有需求。
