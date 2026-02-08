# CC QwQ 桌面端架构设计

**日期**: 2026-01-31
**版本**: 1.0

## 概述

本文档描述 CC QwQ 桌面端应用的整体架构设计。桌面端是一个 Electron 应用，允许用户选择项目目录并通过对话界面与 Claude Code 交互，同时为后续的移动端远程控制预留接口。

## 技术选型

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 19 | 使用内置状态管理，无额外状态库 |
| 样式 | Tailwind CSS | 遵循 design.md 的设计规范 |
| 桌面框架 | Electron 40 | 跨平台桌面应用 |
| 存储 | localStorage | 用于最近项目列表等配置 |
| 构建工具 | Vite | 快速的开发体验 |

## 整体架构

### 架构模式

采用**单页应用 + 条件渲染**架构：

- 所有页面组件在一个 App 中，通过状态控制显示
- 无需路由库，减少依赖
- 适合 Electron 应用的单页特性

### 应用状态结构

```typescript
interface AppState {
  // 当前页面
  currentPage: 'open' | 'conversation' | 'settings'
  // 选中的项目路径
  projectPath: string | null
  // 最近项目列表
  recentProjects: Project[]
  // 应用设置
  settings: Settings
}
```

### 页面流转

```
启动 → 项目打开页面
         ↓ 选择项目
     对话页面
         ↓ 点击 Link Phone
     设置页面 (可返回)
```

## 目录结构

```
src/
├── App.tsx              # 主入口，管理全局状态和页面切换
├── main.tsx             # React 挂载点
├── index.css            # Tailwind 入口 + 全局样式
├── pages/               # 各页面组件
│   ├── ProjectOpenPage.tsx    # 项目打开页面
│   ├── ConversationPage.tsx   # 对话页面
│   └── SettingsPage.tsx       # 设置页面
├── components/          # 可复用组件
│   ├── ui/              # 基础 UI 组件（按钮、输入框等）
│   └── shared/          # 业务组件（历史记录列表等）
├── hooks/               # 自定义 Hooks
│   ├── useProjects.ts   # 管理最近项目
│   └── useClaude.ts     # Claude Code 交互
├── lib/                 # 工具函数
│   ├── storage.ts       # localStorage 封装
│   └── ipc.ts           # Electron IPC 通信
└── types/               # TypeScript 类型定义
```

## 核心组件设计

### App.tsx

管理全局状态和页面切换：

```tsx
function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('open')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [recentProjects, setRecentProjects] = useProjects()

  // 根据 currentPage 条件渲染对应页面
}
```

### 页面组件职责

| 页面 | 职责 | Props |
|------|------|-------|
| `ProjectOpenPage` | 选择文件夹、显示最近项目 | `onProjectSelect` |
| `ConversationPage` | Claude 对话界面、历史记录 | `projectPath`, `onOpenSettings` |
| `SettingsPage` | 生成二维码、设置密码 | `onBack` |

## 数据流设计

### 项目选择流程

1. 用户点击 "Open Folder"
2. 调用 Electron IPC 打开目录选择器
3. 获取选中的路径
4. 保存到 `recentProjects`（localStorage）
5. 切换 `currentPage` 为 `'conversation'`

### 最近项目管理

- 使用 `useProjects` hook 封装 localStorage 操作
- 自动按"最近打开时间"排序
- 限制最多保存 10-20 条记录

### Claude 交互（预留）

- `useClaude` hook 处理与 Claude Code 的通信
- 目前先做 UI，后续对接 Electron 子进程调用

## 样式系统

### Tailwind 配置

遵循 design.md 的设计规范：

- 8 点间距系统（4, 8, 16, 24...）
- 60-30-10 配色比例（60% 背景、30% 表面、10% 强调）
- 最小调色板：白、黑、中性灰
- 触摸区域最小 48×48px

### 颜色规范

```css
background: #ffffff   /* 60% - 主背景 */
surface: #f5f5f5      /* 30% - 卡片表面 */
primary: #1a1a1a      /* 10% - 强调色（炭黑） */
```

### 基础 UI 组件

| 组件 | Tailwind 类示例 |
|------|---------------|
| Button | `px-6 py-3 rounded-lg bg-primary text-white` |
| Input | `w-full px-4 py-3 border border-gray-200 rounded-lg` |
| Card | `bg-white rounded-xl shadow-sm p-6` |
| Modal | `fixed inset-0 bg-black/50 flex items-center justify` |

## 错误处理

### 用户操作错误

- 文件夹选择取消 → 不做处理，停留在当前页
- 无效的项目路径 → 显示 toast 提示

### 数据加载错误

- localStorage 读取失败 → 使用空数组作为默认值
- Electron IPC 调用失败 → 显示错误提示，记录日志

### 错误边界

在 App 外层包裹 ErrorBoundary，捕获渲染错误并显示友好页面。

## 扩展性设计

### IPC 通信封装

将所有 Electron IPC 调用封装到 `lib/ipc.ts`：

```typescript
export const ipc = {
  openFolder: () => window.electronAPI?.openFolder(),
  // 后续扩展...
}
```

### 为移动端预留

- Claude 对话逻辑抽取到 `useClaude` hook
- 后续移动端可通过 WebSocket 复用
- 桌面端作为"服务端"，移动端作为"客户端"

## 开发路径

1. **第一阶段**：项目打开页 + 路由架构
2. **第二阶段**：对话页面 UI（不含实际 Claude 调用）
3. **第三阶段**：设置页面 + 二维码生成
4. **第四阶段**：对接 Claude Code CLI
5. **第五阶段**：移动端开发

## 类型定义

```typescript
interface Project {
  path: string
  name: string
  lastOpened: number
}

interface Settings {
  linkPassword: string
  port: number
}

type PageType = 'open' | 'conversation' | 'settings'
```
