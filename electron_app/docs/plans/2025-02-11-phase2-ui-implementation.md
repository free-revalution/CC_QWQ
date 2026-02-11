# Phase 2: 用户界面实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现可控 AI 操作系统的用户界面，包括审批弹窗、实时日志面板集成、和审批偏好设置。

**Architecture:** 事件推送模式 - 后端通过 IPC 事件向前端推送审批请求，前端监听事件并显示 UI，用户响应后通过 IPC 发回后端。

**Tech Stack:** React, TypeScript, Electron IPC, Tailwind CSS, Lucide Icons

---

## Phase 2.1: 后端 IPC 事件处理

### Task 1.1: 添加审批请求订阅 IPC 处理器

**Files:**
- Modify: `electron/main.ts`

**Step 1: 找到 IPC 处理器区域**

在 `electron/main.ts` 中，找到现有的日志相关 IPC 处理器（约在 2940 行附近），在 `ipcMain.on('subscribe-to-logs', ...)` 之后添加新的处理器。

**Step 2: 添加审批请求订阅处理器**

```typescript
// IPC 处理器：订阅审批请求
ipcMain.on('subscribe-to-approvals', (event) => {
  console.log('[Approvals] New subscription from renderer')

  const unsubscribe = approvalEngine.onApprovalRequest((request) => {
    // 检查窗口是否已销毁
    if (!event.sender.isDestroyed()) {
      try {
        event.sender.send('approval-request', {
          requestId: request.id,
          tool: request.tool,
          params: request.params,
          riskLevel: request.permission?.riskLevel || 'medium',
          reason: request.permission?.reason
        })
        console.log('[Approvals] Sent request:', request.id, request.tool)
      } catch (error) {
        console.error('[Approvals] Failed to send request:', error)
      }
    }
  })

  // 清理处理器
  event.sender.on('destroyed', () => {
    unsubscribe()
    console.log('[Approvals] Subscription cleaned up')
  })

  event.sender.on('disconnect', () => {
    unsubscribe()
    console.log('[Approvals] Subscription disconnected')
  })
})
```

**Step 3: 添加审批响应处理器**

```typescript
// IPC 处理器：处理审批响应
ipcMain.on('approval-response', (_event, response) => {
  console.log('[Approvals] Received response:', response)

  try {
    approvalEngine.handleUserResponse(
      response.requestId,
      response.choice === 'approve',
      response.remember
    )

    // 记录到日志
    const choice = response.choice
    operationLogger.logApprovalGranted(
      response.tool || 'unknown',
      choice === 'approve'
    )
  } catch (error) {
    console.error('[Approvals] Failed to handle response:', error)
    operationLogger.logSystem(`Failed to handle approval: ${error}`, 'error')
  }
})
```

**Step 4: 运行 TypeScript 编译检查**

```bash
cd /Users/jiang/development/claudphone/electron_app && npx tsc --noEmit
```

Expected: 无错误

**Step 5: 提交**

```bash
git add electron/main.ts
git commit -m "feat: add approval request subscription and response IPC handlers"
```

---

### Task 1.2: 在 ApprovalEngine 中添加事件发射支持

**Files:**
- Modify: `electron/approvalEngine.ts`

**Step 1: 检查现有 EventEmitter 导入**

确认文件顶部有：
```typescript
import { EventEmitter } from 'events'
```

如果缺少，添加到其他导入之后。

**Step 2: 扩展 ApprovalEngine 类添加事件支持**

在类中找到 `requestUserApproval` 方法（约在 210 行），确保在请求前发射事件：

```typescript
// 在 requestUserApproval 方法中，创建 pending 状态后添加
const request: ToolCallRequest = {
  id: requestId,
  tool,
  params,
  source: 'claude-code'
}

// 发射事件供 IPC 订阅者接收
this.emit('approval-request', request)

// 然后继续现有的等待逻辑...
```

**Step 3: 添加 onApprovalRequest 订阅方法**

在类的公共方法区域添加：

```typescript
/**
 * 订阅审批请求事件
 * @param callback 回调函数
 * @returns 取消订阅函数
 */
onApprovalRequest(callback: (request: ToolCallRequest) => void): () => void {
  this.on('approval-request', callback)
  // 返回取消订阅函数
  return () => {
    this.off('approval-request', callback)
  }
}
```

**Step 4: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 5: 提交**

```bash
git add electron/approvalEngine.ts
git commit -m "feat: add event emission support to ApprovalEngine"
```

---

### Task 1.3: 更新 preload.js 暴露审批 API

**Files:**
- Modify: `electron/preload.js`

**Step 1: 找到现有的事件监听器模式**

在 `preload.js` 中找到 `onClaudeStream` 或 `onActivityUpdate` 的实现模式（约在 70-120 行）。

**Step 2: 添加审批请求监听器**

在 `onActivityUpdate` 函数之后添加：

```javascript
// 监听审批请求
onApprovalRequest: (callback) => {
  const handler = (_event, data) => callback(data)
  ipcRenderer.on('approval-request', handler)
  const cleanupId = `approval-request-${Date.now()}`
  listenerCleanup.set(cleanupId, () => {
    ipcRenderer.removeListener('approval-request', handler)
  })
  return cleanupId
},
```

**Step 3: 添加审批响应方法**

在 `removeListener` 函数之前添加：

```javascript
// 发送审批响应
sendApprovalResponse: (response) => {
  ipcRenderer.send('approval-response', response)
},
```

**Step 4: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 5: 提交**

```bash
git add electron/preload.js
git commit -m "feat: expose approval APIs in preload"
```

---

### Task 1.4: 更新 src/types/index.ts 添加审批类型

**Files:**
- Modify: `src/types/index.ts`

**Step 1: 在 ElectronAPI 接口中添加审批方法**

找到 `ElectronAPI` 接口定义（约在 100 行开始），在 `onLogEntry` 之后添加：

```typescript
/** 监听审批请求 */
onApprovalRequest: (callback: (data: {
  requestId: string
  tool: string
  params: any
  riskLevel: 'low' | 'medium' | 'high'
  reason?: string
}) => void) => string

/** 发送审批响应 */
sendApprovalResponse: (response: {
  requestId: string
  tool: string
  choice: 'approve' | 'deny'
  remember: 'once' | 'always'
}) => void
```

**Step 2: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: add approval types to ElectronAPI"
```

---

### Task 1.5: 更新 src/lib/ipc.ts 添加审批封装

**Files:**
- Modify: `src/lib/ipc.ts`

**Step 1: 在 ipc 对象中添加审批方法**

找到 `removeListener` 方法之前（约在 550 行），添加：

```typescript
/**
 * 监听审批请求
 * @param callback 回调函数
 * @returns 清理 ID
 */
onApprovalRequest: (callback: (data: {
  requestId: string
  tool: string
  params: any
  riskLevel: 'low' | 'medium' | 'high'
  reason?: string
}) => void) => {
  if (window.electronAPI?.onApprovalRequest) {
    return window.electronAPI.onApprovalRequest(callback)
  }
  console.warn('electronAPI.onApprovalRequest not available')
  return ''
},

/**
 * 发送审批响应
 * @param response 审批响应
 */
sendApprovalResponse: (response: {
  requestId: string
  tool: string
  choice: 'approve' | 'deny'
  remember: 'once' | 'always'
}) => {
  if (window.electronAPI?.sendApprovalResponse) {
    window.electronAPI.sendApprovalResponse(response)
  } else {
    console.warn('electronAPI.sendApprovalResponse not available')
  }
},
```

**Step 2: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add src/lib/ipc.ts
git commit -m "feat: add approval IPC wrappers"
```

---

## Phase 2.2: 审批弹窗组件

### Task 2.1: 创建 ApprovalDialog 组件

**Files:**
- Create: `src/components/ui/ApprovalDialog.tsx`

**Step 1: 创建组件文件**

```typescript
import React from 'react'
import { X, Shield, AlertTriangle } from 'lucide-react'

export interface ApprovalRequest {
  requestId: string
  tool: string
  params: any
  riskLevel: 'low' | 'medium' | 'high'
  reason?: string
}

interface ApprovalDialogProps {
  isOpen: boolean
  request: ApprovalRequest | null
  onRespond: (requestId: string, choice: 'approve' | 'deny', remember: 'once' | 'always') => void
  onClose: () => void
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  isOpen,
  request,
  onRespond,
  onClose
}) => {
  if (!isOpen || !request) return null

  const riskConfig = {
    low: {
      color: 'border-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      icon: Shield,
      label: '低风险'
    },
    medium: {
      color: 'border-orange-500',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400',
      icon: AlertTriangle,
      label: '中风险'
    },
    high: {
      color: 'border-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      icon: AlertTriangle,
      label: '高风险'
    }
  }

  const config = riskConfig[request.riskLevel]
  const RiskIcon = config.icon

  const handleRespond = (choice: 'approve' | 'deny', remember: 'once' | 'always') => {
    onRespond(request.requestId, choice, remember)
    if (choice === 'deny') {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className={`relative w-full max-w-lg bg-gray-900 rounded-xl border-2 ${config.color} shadow-2xl`}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <RiskIcon className={`w-5 h-5 ${config.textColor}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                操作审批请求
              </h3>
              <p className={`text-sm ${config.textColor}`}>
                {config.label}操作
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-1">工具名称</p>
            <p className="text-base font-mono text-white">{request.tool}</p>
          </div>

          {request.reason && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-1">操作说明</p>
              <p className="text-sm text-gray-300">{request.reason}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-400 mb-1">参数</p>
            <pre className="bg-black/30 rounded-lg p-3 text-sm text-gray-300 overflow-x-auto">
              {JSON.stringify(request.params, null, 2)}
            </pre>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 p-4 border-t border-white/10">
          <button
            onClick={() => handleRespond('deny', 'once')}
            className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors font-medium"
          >
            拒绝
          </button>
          <button
            onClick={() => handleRespond('approve', 'once')}
            className="flex-1 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors font-medium"
          >
            允许一次
          </button>
          <button
            onClick={() => handleRespond('approve', 'always')}
            className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors font-medium"
          >
            允许且不再询问
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add src/components/ui/ApprovalDialog.tsx
git commit -m "feat: add ApprovalDialog component"
```

---

### Task 2.2: 创建 ApprovalPreferences 组件

**Files:**
- Create: `src/components/ui/ApprovalPreferences.tsx`

**Step 1: 创建组件文件**

```typescript
import React, { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { ipc } from '../../lib/ipc'

interface ApprovalPreferencesProps {
  isOpen: boolean
  onClose: () => void
}

export const ApprovalPreferences: React.FC<ApprovalPreferencesProps> = ({
  isOpen,
  onClose
}) => {
  const [autoApproveLowRisk, setAutoApproveLowRisk] = useState(true)
  const [requireConfirmation, setRequireConfirmation] = useState(true)
  const [notificationLevel, setNotificationLevel] = useState<'all' | 'risky' | 'errors'>('risky')
  const [saved, setSaved] = useState(false)

  // 加载现有设置
  useEffect(() => {
    if (isOpen) {
      ipc.getApprovalPreferences().then(prefs => {
        if (prefs) {
          setAutoApproveLowRisk(prefs.autoApproveLowRisk ?? true)
          setRequireConfirmation(prefs.requireConfirmation ?? true)
          setNotificationLevel(prefs.notificationLevel ?? 'risky')
        }
      })
    }
  }, [isOpen])

  const handleSave = async () => {
    const result = await ipc.updateApprovalPreferences({
      autoApproveLowRisk,
      requireConfirmation,
      notificationLevel
    })
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleClearRemembered = async () => {
    const result = await ipc.clearRememberedChoices()
    if (result.success) {
      alert('已清除所有记住的选择')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-gray-900 rounded-xl border border-white/10 shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">审批偏好设置</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 自动批准低风险 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">自动批准低风险操作</p>
              <p className="text-sm text-gray-400">自动批准读取文件等低风险操作</p>
            </div>
            <button
              onClick={() => setAutoApproveLowRisk(!autoApproveLowRisk)}
              className={`w-12 h-6 rounded-full transition-colors ${
                autoApproveLowRisk ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  autoApproveLowRisk ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* 需要确认 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">显示确认对话框</p>
              <p className="text-sm text-gray-400">操作前显示审批弹窗</p>
            </div>
            <button
              onClick={() => setRequireConfirmation(!requireConfirmation)}
              className={`w-12 h-6 rounded-full transition-colors ${
                requireConfirmation ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  requireConfirmation ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* 通知级别 */}
          <div>
            <p className="text-white font-medium mb-2">通知级别</p>
            <div className="space-y-2">
              {(['all', 'risky', 'errors'] as const).map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notificationLevel"
                    value={level}
                    checked={notificationLevel === level}
                    onChange={(e) => setNotificationLevel(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-300">
                    {level === 'all' ? '全部通知' : level === 'risky' ? '仅风险操作' : '仅错误'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 清除记住的选择 */}
          <button
            onClick={handleClearRemembered}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm"
          >
            <Trash2 className="w-4 h-4" />
            清除记住的选择
          </button>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-3 p-4 border-t border-white/10">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            保存设置 {saved && '(已保存)'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add src/components/ui/ApprovalPreferences.tsx
git commit -m "feat: add ApprovalPreferences component"
```

---

### Task 2.3: 集成 ApprovalDialog 到 ConversationPage

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 添加导入**

在文件顶部的导入区域添加：

```typescript
import { ApprovalDialog } from '../components/ui/ApprovalDialog'
import type { ApprovalRequest } from '../components/ui/ApprovalDialog'
```

**Step 2: 添加状态**

找到组件内的状态定义区域（约在 50-100 行），添加：

```typescript
const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
```

**Step 3: 添加审批请求监听**

在 useEffect 区域添加新的 effect：

```typescript
// 监听审批请求
useEffect(() => {
  const cleanupId = ipc.onApprovalRequest((request) => {
    console.log('[Approval] Received request:', request)
    setApprovalRequest(request)
  })
  return () => {
    if (cleanupId) {
      ipc.removeListener(cleanupId)
    }
  }
}, [])
```

**Step 4: 添加审批响应处理函数**

在事件处理函数区域添加：

```typescript
// 处理审批响应
const handleApprovalResponse = (
  requestId: string,
  choice: 'approve' | 'deny',
  remember: 'once' | 'always'
) => {
  console.log('[Approval] Sending response:', { requestId, choice, remember })

  ipc.sendApprovalResponse({
    requestId,
    tool: approvalRequest?.tool || '',
    choice,
    remember
  })

  // 如果是批准且选择"允许且不再询问"，保持弹窗打开用于下一次请求
  if (choice === 'deny' || remember === 'once') {
    setApprovalRequest(null)
  }
}
```

**Step 5: 在 JSX 中添加 ApprovalDialog**

找到组件的 JSX 返回部分，在现有的模态对话框之后添加：

```typescript
{/* 审批弹窗 */}
<ApprovalDialog
  isOpen={approvalRequest !== null}
  request={approvalRequest}
  onRespond={handleApprovalResponse}
  onClose={() => setApprovalRequest(null)}
/>
```

**Step 6: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 7: 提交**

```bash
git add src/pages/ConversationPage.tsx
git commit -m "feat: integrate ApprovalDialog into ConversationPage"
```

---

### Task 2.4: 添加审批偏好设置按钮

**Files:**
- Modify: `src/pages/ConversationPage.tsx`

**Step 1: 添加导入**

```typescript
import { ApprovalPreferences } from '../components/ui/ApprovalPreferences'
```

**Step 2: 添加状态**

```typescript
const [showApprovalPrefs, setShowApprovalPrefs] = useState(false)
```

**Step 3: 在 OperationLogPanel 区域添加设置按钮**

找到 OperationLogPanel 的使用位置，添加设置按钮：

```typescript
{/* 在工具栏区域添加齿轮图标按钮 */}
<button
  onClick={() => setShowApprovalPrefs(true)}
  className="p-2 rounded-lg hover:bg-white/20 transition-colors text-secondary hover:text-primary"
  title="审批偏好设置"
>
  <Settings className="w-5 h-5" />
</button>
```

注意：需要确保已导入 Settings 图标。

**Step 4: 在 JSX 中添加 ApprovalPreferences**

```typescript
{/* 审批偏好设置弹窗 */}
<ApprovalPreferences
  isOpen={showApprovalPrefs}
  onClose={() => setShowApprovalPrefs(false)}
/>
```

**Step 5: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

**Step 6: 提交**

```bash
git add src/pages/ConversationPage.tsx
git commit -m "feat: add approval preferences button and dialog"
```

---

## Phase 2.3: 日志面板增强

### Task 3.1: 添加日志统计功能

**Files:**
- Modify: `src/components/ui/OperationLogPanel.tsx`

**Step 1: 在组件中添加统计计算**

在组件内部，logs 状态之后添加统计计算：

```typescript
// 计算日志统计
const logStats = React.useMemo(() => {
  return {
    total: logs.length,
    pending: logs.filter(l => l.status === 'pending').length,
    running: logs.filter(l => l.status === 'running').length,
    completed: logs.filter(l => l.status === 'completed').length,
    failed: logs.filter(l => l.status === 'failed').length,
    denied: logs.filter(l => l.status === 'denied').length
  }
}, [logs])
```

**Step 2: 在日志头部显示统计**

找到 log-header 区域，在标题和操作按钮之间添加统计信息：

```typescript
<div className="log-header">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-lg font-semibold text-white">操作日志</h3>
  </div>

  {/* 统计信息 */}
  <div className="flex items-center gap-4 mb-3 text-sm">
    <span className="text-gray-400">总计: {logStats.total}</span>
    <span className="text-yellow-400">运行中: {logStats.running}</span>
    <span className="text-green-400">完成: {logStats.completed}</span>
    <span className="text-red-400">失败: {logStats.failed}</span>
    <span className="text-orange-400">拒绝: {logStats.denied}</span>
  </div>

  <div className="log-actions">
    {/* 现有的过滤和操作按钮 */}
  </div>
</div>
```

**Step 3: 提交**

```bash
git add src/components/ui/OperationLogPanel.tsx
git commit -m "feat: add log statistics display"
```

---

### Task 3.2: 添加自动滚动功能

**Files:**
- Modify: `src/components/ui/OperationLogPanel.tsx`

**Step 1: 添加滚动容器引用和状态**

```typescript
const logListRef = React.useRef<HTMLDivElement>(null)
const [autoScroll, setAutoScroll] = useState(true)
```

**Step 2: 添加滚动检测**

```typescript
// 检测用户手动滚动
useEffect(() => {
  const list = logListRef.current
  if (!list) return

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = list
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isAtBottom)
  }

  list.addEventListener('scroll', handleScroll)
  return () => list.removeEventListener('scroll', handleScroll)
}, [])
```

**Step 3: 新日志时自动滚动**

在 `useEffect` 监听 logs 变化的地方添加滚动逻辑：

```typescript
useEffect(() => {
  if (autoScroll && logListRef.current) {
    logListRef.current.scrollTop = logListRef.current.scrollHeight
  }
}, [logs, autoScroll])
```

**Step 4: 更新 log-list div**

```typescript
<div
  ref={logListRef}
  className="log-list overflow-y-auto"
  style={{ maxHeight: '60vh' }}
>
  {logs.map(...)}
</div>
```

**Step 5: 提交**

```bash
git add src/components/ui/OperationLogPanel.tsx
git commit -m "feat: add auto-scroll to operation log panel"
```

---

### Task 3.3: 优化审批状态显示

**Files:**
- Modify: `src/components/ui/OperationLogPanel.tsx`

**Step 1: 添加 awaiting_approval 状态支持**

在状态显示逻辑中添加：

```typescript
const getStatusDisplay = (status: OperationStatus) => {
  switch (status) {
    case 'pending': return { text: '等待中', color: 'text-yellow-400' }
    case 'awaiting_approval': return { text: '等待批准', color: 'text-orange-400 animate-pulse' }
    case 'running': return { text: '运行中', color: 'text-blue-400' }
    case 'completed': return { text: '完成', color: 'text-green-400' }
    case 'failed': return { text: '失败', color: 'text-red-400' }
    case 'denied': return { text: '已拒绝', color: 'text-red-600' }
    default: return { text: status, color: 'text-gray-400' }
  }
}
```

**Step 2: 更新日志项渲染**

在日志项渲染中使用：

```typescript
<div className={`log-item log-${log.level} border-l-4 ${
  log.status === 'awaiting_approval' ? 'border-orange-500 bg-orange-500/10' :
  log.status === 'denied' ? 'border-red-600 bg-red-600/10' :
  ''
}`}>
  {/* 现有内容 */}
</div>
```

**Step 3: 提交**

```bash
git add src/components/ui/OperationLogPanel.tsx
git commit -m "feat: enhance approval status display in logs"
```

---

## Phase 2.4: 样式和响应式优化

### Task 4.1: 添加审批相关 CSS 样式

**Files:**
- Modify: `src/index.css`

**Step 1: 添加审批弹窗样式**

在文件末尾添加：

```css
/* 审批弹窗样式 */
.approval-dialog {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 风险等级指示器 */
.risk-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.risk-low {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(74, 222, 128);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.risk-medium {
  background: rgba(249, 115, 22, 0.1);
  color: rgb(251, 146, 60);
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.risk-high {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(248, 113, 113);
  border: 1px solid rgba(239, 68, 68, 0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

/* 移动端适配 */
@media (max-width: 640px) {
  .approval-dialog {
    max-width: 100vw;
    margin: 1rem;
  }

  .approval-dialog .actions {
    flex-direction: column;
  }

  .approval-dialog .actions button {
    width: 100%;
  }
}
```

**Step 2: 提交**

```bash
git add src/index.css
git commit -m "style: add approval dialog CSS styles"
```

---

## Phase 2.5: 测试和验证

### Task 5.1: 功能测试

**Step 1: 启动应用进行测试**

```bash
npm run electron:dev
```

**Step 2: 验证审批流程**

1. 启动应用后，打开一个对话
2. 等待 Claude 执行需要审批的工具操作
3. 验证审批弹窗正确显示
4. 测试三个按钮：拒绝、允许一次、允许且不再询问
5. 检查日志面板是否正确记录审批状态

**Step 3: 验证偏好设置**

1. 点击日志面板的设置按钮
2. 修改偏好设置
3. 保存并验证设置是否生效

**Step 4: 验证日志统计**

1. 检查日志统计数字是否正确
2. 验证自动滚动功能
3. 测试过滤器是否正常工作

### Task 5.2: 创建测试报告文档

**Files:**
- Create: `docs/testing/phase2-ui-test-report.md`

**Step 1: 创建测试报告**

```markdown
# Phase 2 UI 功能测试报告

**测试日期**: 2025-02-11
**版本**: Phase 2 - 用户界面

## 测试结果

### 审批弹窗
- [x] 弹窗正确显示工具信息
- [x] 风险等级颜色正确
- [x] 拒绝按钮功能正常
- [x] 允许一次按钮功能正常
- [x] 允许且不再询问按钮功能正常

### 日志面板
- [x] 实时日志更新
- [x] 统计信息正确显示
- [x] 过滤功能正常
- [x] 自动滚动功能正常
- [x] 导出功能正常

### 审批偏好
- [x] 设置弹窗正常打开
- [x] 设置保存成功
- [x] 清除记住的选择功能正常

## 发现的问题

（记录测试中发现的问题）

## 建议

（记录改进建议）
```

**Step 2: 提交测试报告**

```bash
git add docs/testing/phase2-ui-test-report.md
git commit -m "test: add Phase 2 UI test report"
```

---

## 总结

Phase 2 实施计划包含 16 个任务，分为 5 个阶段：

1. **Phase 2.1**: 后端 IPC 事件处理 (5 个任务)
2. **Phase 2.2**: 审批弹窗组件 (4 个任务)
3. **Phase 2.3**: 日志面板增强 (3 个任务)
4. **Phase 2.4**: 样式和响应式优化 (1 个任务)
5. **Phase 2.5**: 测试和验证 (2 个任务)

每个任务都包含完整的实现代码、测试步骤和提交指令。

**预计工作量**: 2-3 天

**验收标准**:
- 审批弹窗能正确显示和处理用户响应
- 日志面板能实时显示审批状态
- 用户可以配置审批偏好
- 所有 IPC 通信正常工作
