# 移动端与桌面端同步功能设计文档

**日期**: 2025-02-08
**状态**: 设计完成，待实现

---

## 问题概述

### 现有问题
1. **桌面端性能问题**: 滚动时出现空白块，组件未及时加载
2. **移动端连接问题**:
   - 离开 Link phone 页面就自动切换新对话
   - 气泡太窄，文字无法正常显示

### 新需求
1. 移动端通过隐藏侧边栏显示桌面端的 Conversation 列表（含状态指示灯）
2. 移动端可进入任意对话聊天，消息单向同步到桌面端
3. 桌面端支持发送消息、上传图片、文件等

---

## 架构设计

### WebSocket 消息类型扩展

#### 桌面端 → 移动端

```typescript
// Conversation 列表
{
  type: 'conversation-list',
  data: {
    conversations: Array<{
      id: string
      title: string
      status: 'not_started' | 'initializing' | 'ready'
      lastMessage?: string
      updatedAt: number
    }>
  }
}

// Conversation 更新通知
{
  type: 'conversation-update',
  data: { conversations: Conversation[] }
}
```

#### 移动端 → 桌面端

```typescript
// 选择 Conversation
{
  type: 'select-conversation',
  data: { conversationId: string }
}

// 发送消息（带目标 conversationId）
{
  type: 'message',
  data: {
    conversationId: string
    content: string
  }
}
```

---

## 消息同步流程

```
移动端发送消息:
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户在移动端输入消息                                      │
│ 2. 发送 WebSocket 消息:                                     │
│    { type: 'message', data: { conversationId, content } }   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 桌面端 WebSocket 服务器接收                                  │
│ 1. 解析 conversationId                                     │
│ 2. 调用 callClaude(conversationId, projectPath, content)    │
│ 3. Claude 响应通过 PTY 数据流返回                           │
│ 4. 经过 filterTerminalUI() 过滤                             │
│ 5. 通过 'claude-stream' 事件发送到桌面端 UI                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 桌面端 UI 更新 (ConversationPage.tsx)                       │
│ 1. ipc.onClaudeStream 接收数据                              │
│ 2. 根据 conversationId 路由到正确的 conversation            │
│ 3. 更新 messages 数组并持久化                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 后端实现

### 新增 IPC 处理器

**`get-conversation-list`** - 获取 Conversation 列表

```typescript
ipcMain.handle('get-conversation-list', async () => {
  const conversations = Array.from(claudeSessions.entries()).map(
    ([convId, session]) => ({
      id: convId,
      title: convId,
      status: session.isInitialized
        ? (session.state === 'ready' ? 'ready' : 'initializing')
        : 'not_started',
      updatedAt: session.lastUserMessage ? Date.now() : 0
    })
  )

  return { success: true, conversations }
})
```

### WebSocket 服务器更新

**发送 Conversation 列表**

```typescript
const sendConversationList = (ws: WebSocketClient) => {
  const conversations = Array.from(claudeSessions.entries()).map(
    ([id, session]) => ({
      id,
      title: id,
      status: session.isInitialized
        ? (session.state === 'ready' ? 'ready' : 'initializing')
        : 'not_started',
      updatedAt: session.lastUserMessage ? Date.now() : 0
    })
  )

  ws.send(JSON.stringify({
    type: 'conversation-list',
    data: { conversations }
  }))
}

const completeAuth = () => {
  isAuthenticated = true
  hasCompletedAuth = true
  mobileClients.add(ws)
  ws.send(JSON.stringify({ type: 'auth', success: true }))
  sendConversationList(ws)  // 发送列表
}
```

**处理移动端选择 Conversation**

```typescript
// 扩展 WebSocket 客户端类型
interface WebSocketClient {
  selectedConversationId?: string
}

// 在消息处理中
else if (message.type === 'select-conversation') {
  ws.selectedConversationId = message.data.conversationId
  broadcastConversationList()  // 广播更新
}

else if (message.type === 'message') {
  const targetConversationId = ws.selectedConversationId || message.data.conversationId
  const response = await callClaude(
    targetConversationId,
    currentProjectPath,
    message.data.content
  )
  // ...
}
```

---

## 移动端 UI 设计

### 隐藏侧边栏结构

```typescript
<MobileLayout>
  <Drawer isOpen={showSidebar} onClose={() => setShowSidebar(false)}>
    <ConversationList>
      {conversations.map(conv => (
        <ConversationItem
          key={conv.id}
          title={conv.title}
          status={conv.status}
          isSelected={selectedConversationId === conv.id}
          onClick={() => selectConversation(conv.id)}
        />
      ))}
    </ConversationList>
  </Drawer>

  <ChatArea>
    <Messages />
    <InputArea />
  </ChatArea>
</MobileLayout>
```

### 状态呼吸灯组件

```typescript
const StatusIndicator = ({ status }) => {
  const colors = {
    not_started: 'bg-gray-500',
    initializing: 'bg-yellow-500 animate-pulse',
    ready: 'bg-green-500'
  }

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
  )
}
```

### 修复气泡宽度

```css
.mobile-message-bubble {
  max-width: 85%;        /* 从 60% 增加到 85% */
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
```

---

## 桌面端文件上传功能

### 输入区域增强

```typescript
<div className="input-area flex items-end gap-2">
  <button onClick={handleFileUpload} title="上传文件">
    <Paperclip size={20} />
  </button>

  {selectedFiles.length > 0 && (
    <div className="file-preview">
      {selectedFiles.map(file => (
        <FileChip
          key={file.name}
          name={file.name}
          size={file.size}
          onRemove={() => removeFile(file)}
        />
      ))}
    </div>
  )}

  <textarea
    value={inputValue}
    onChange={(e) => setInputValue(e.target.value)}
  />

  <button onClick={handleSend}>发送</button>
</div>
```

### 文件处理 IPC

```typescript
ipcMain.handle('select-file', async () => {
  const { dialog } = await import('electron')
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Code Files', extensions: ['js', 'ts', 'py', 'java', 'cpp'] },
      { name: 'Text Files', extensions: ['txt', 'md', 'json'] },
      { name: 'Images', extensions: ['png', 'jpg', 'gif', 'svg'] }
    ]
  })

  if (result.canceled) return { success: false }
  return { success: true, filePath: result.filePaths[0] }
})

ipcMain.handle('upload-file', async (_event, filePath: string, conversationId: string) => {
  const content = handleFileContent(filePath)
  const messageId = await callClaude(conversationId, currentProjectPath, content)
  return { success: true, messageId }
})
```

---

## 桌面端滚动性能优化

### 问题分析
1. 未使用虚拟列表：所有消息都渲染
2. 消息组件重渲染：每次更新都重渲染整个列表
3. 代码块语法高亮：Shiki 高亮大型代码块耗时

### 解决方案

#### 1. 虚拟滚动

```typescript
import { FixedSizeList } from 'react-window'

const MessageList = ({ messages }) => {
  const rowRenderer = ({ index, style }) => {
    const message = messages[index]
    return (
      <div style={style}>
        <MessageContent message={message} />
      </div>
    )
  }

  return (
    <FixedSizeList
      height={containerHeight}
      itemCount={messages.length}
      itemSize={150}
      width="100%"
    >
      {rowRenderer}
    </FixedSizeList>
  )
}
```

#### 2. 组件优化

```typescript
const MessageContent = React.memo(({ message }), (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.content === next.message.content
})
```

#### 3. 延迟语法高亮

```typescript
const LazySyntaxHighlight = ({ code, language }) => {
  const [highlighted, setHighlighted] = useState(false)

  useEffect(() => {
    const id = requestIdleCallback(() => {
      highlightCode(code, language).then(setHighlighted)
    })
    return () => cancelIdleCallback(id)
  }, [code, language])

  return highlighted ? (
    <code dangerouslySetInnerHTML={{ __html: highlighted }} />
  ) : (
    <code>{code}</code>
  )
}
```

---

## 错误处理

### 边缘情况处理

| 场景 | 处理方案 |
|------|---------|
| 桌面端关闭正在聊天的 conversation | 通知移动端切换，显示提示 |
| 移动端发送消息时 conversation 不存在 | 返回错误，提示重新选择 |
| 网络延迟导致消息重复 | 前端去重（基于 messageId） |
| 文件上传失败 | 保留输入，显示错误，允许重试 |
| PTY 进程崩溃 | 自动重启，通知用户恢复 |

---

## 实施计划

详细实施步骤请见实现计划文档。

---

## 附录

### 相关文件
- `electron/main.ts` - WebSocket 服务器、IPC 处理器
- `src/pages/ConversationPage.tsx` - 桌面端对话页面
- `src/pages/SettingsPage.tsx` - Link phone 功能
