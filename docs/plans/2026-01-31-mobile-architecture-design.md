# CC QwQ 移动端架构设计

**日期**: 2026-01-31
**版本**: 1.0

## 概述

本文档描述 CC QwQ 移动端应用的整体架构设计。移动端是 React Native (Expo) 应用，通过 WebSocket 与桌面端通信，实现远程控制 Claude Code 的功能。

## 技术选型

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Expo + React Native | 跨平台移动应用 |
| 通信 | WebSocket | 实时双向通信 |
| 二维码 | expo-camera | 扫描桌面端二维码 |
| 状态管理 | React 19 内置 | useTransition + Context |
| 样式 | StyleSheet | React Native 内置 |

## 整体架构

### 通信方式

**WebSocket 实时双向通信**

桌面端在 Electron 主进程中启动 WebSocket 服务器，移动端作为客户端连接。

```
桌面端启动 → WebSocket 服务器 (端口 3000)
           ↓
    生成二维码 (IP + 端口)
           ↓
    移动端扫描二维码 + 输入密码
           ↓
    建立 WebSocket 连接
           ↓
    实时双向通信
```

### 认证与安全

**二维码 + 密码双重验证**

1. 二维码包含：连接 URL（ws://[IP]:3000）
2. 用户手动输入密码
3. 桌面端验证后允许连接

## 通信协议

### 消息格式

所有消息使用 JSON 格式：

```typescript
// 认证消息（客户端 → 服务端）
{
  "type": "auth",
  "password": "用户设置的密码"
}

// 发送消息（客户端 → 服务端）
{
  "type": "message",
  "data": {
    "content": "用户输入的内容"
  }
}

// Claude 响应（服务端 → 客户端）
{
  "type": "response",
  "data": {
    "content": "Claude 的回复",
    "timestamp": 1234567890
  }
}

// 状态更新（服务端 → 客户端）
{
  "type": "status",
  "data": {
    "status": "thinking" | "idle" | "error"
  }
}
```

### 连接流程

1. **握手阶段**：
   - 移动端连接 `ws://[桌面IP]:3000`
   - 发送认证消息
   - 桌面端验证，返回成功/失败

2. **消息循环**：
   - 移动端发送消息
   - 桌面端转发给 Claude Code CLI
   - 桌面端返回响应
   - 移动端显示

3. **错误处理**：
   - 连接断开：自动重连
   - 认证失败：重新输入密码
   - 超时：显示加载状态

## 目录结构

```
Expo_app/
├── src/
│   ├── screens/          # 页面组件
│   │   ├── LoginScreen.tsx      # 登录/连接页面
│   │   ├── ChatScreen.tsx       # 对话页面
│   │   └── SettingsScreen.tsx   # 设置页面
│   ├── components/       # 可复用组件
│   │   ├── MessageBubble.tsx    # 消息气泡
│   │   ├── InputBar.tsx         # 输入框
│   │   └── StatusIndicator.tsx  # 状态指示器
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useWebSocket.ts      # WebSocket 连接管理
│   │   └── useAuth.ts           # 认证状态管理
│   ├── services/         # 服务层
│   │   └── api.ts               # API 封装
│   ├── types/            # TypeScript 类型
│   └── utils/            # 工具函数
└── assets/               # 静态资源
```

## 核心组件

### useWebSocket Hook

- 管理 WebSocket 连接生命周期
- 处理消息发送和接收
- 自动重连逻辑（指数退避）
- 消息队列（断线时缓存）

### useAuth Hook

- 密码验证
- 连接状态管理
- 认证状态存储

### 页面组件

1. **LoginScreen**：
   - 二维码扫描
   - 手动输入 IP 和端口
   - 密码输入
   - 连接状态

2. **ChatScreen**：
   - 消息列表
   - 输入框
   - 实时状态

## 数据流

```
用户输入 → WebSocket 发送
         ↓
    桌面端接收
         ↓
    Claude Code CLI
         ↓
    响应返回
         ↓
    移动端更新 UI
```

## 实现计划

### 阶段 1：MVP
- [ ] 二维码扫描/手动输入
- [ ] 密码验证
- [ ] 发送和接收消息
- [ ] 基本错误处理

### 阶段 2：增强
- [ ] 消息历史持久化
- [ ] 自动重连
- [ ] 文件附件
- [ ] 命令菜单

### 阶段 3：完善
- [ ] 流式响应
- [ ] 多对话管理
- [ ] 通知推送
- [ ] 性能优化

## 安全考虑

- 仅限局域网访问
- 密码验证
- 连接超时处理
- 错误消息不泄露敏感信息
