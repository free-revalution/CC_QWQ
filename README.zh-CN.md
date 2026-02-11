# CC QwQ 📱💻

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/free-revalution/CC_QWQ)](https://github.com/free-revalution/CC_QWQ/issues)
[![Status: Active Development](https://img.shields.io/badge/Status-Active--Development-yellow)](https://github.com/free-revalution/CC_QWQ)

> 在手机上远程控制 Claude Code 🚀

[English](README.md) | **简体中文**

## 🎯 什么是 CC QwQ？

CC QwQ 是一个跨平台应用，让你可以在移动设备上与运行在桌面上的 [Claude Code](https://code.anthropic.com) 进行交互。非常适合你不在电脑旁但需要继续编程的场景！

## ✨ 功能特性

- 🖥️ **桌面应用** (Electron)：完整的 Claude Code 界面集成
- 📱 **移动应用** (React Native)：通过二维码扫描远程连接
- 🔒 **安全**：密码保护的局域网连接
- 🌐 **实时**：基于 WebSocket 的即时通信

## ⚠️ 项目状态

本项目正在**积极开发中**。我们正在寻找贡献者来帮助实现这个愿景！

## 🚀 快速开始

### 前置要求
- Node.js 18+
- npm 或 yarn

### 桌面应用

```bash
cd electron_app
npm install
npm run dev / npm run electron:dev
```

### 移动应用

```bash
cd Expo_app
npm install
npx expo start
```

使用手机上的 Expo Go 应用扫描二维码。

## 🏗️ 技术架构

- **桌面端**: Electron + React 19 + Vite + Tailwind CSS
- **移动端**: Expo + React Native + WebSocket
- **通信方式**: 桌面端 WebSocket 服务器，移动端客户端

## 🗺️ 开发路线

- [ ] Claude Code CLI 集成
- [ ] WebSocket 通信层
- [ ] 二维码认证
- [ ] UI 优化和改进
- [ ] 发布构建

## 🤝 贡献

我们欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 开源协议

MIT License - 详见 [LICENSE](LICENSE)。

## 🙏 致谢

本项目基于以下技术构建：
- [Claude Code](https://code.anthropic.com) - AI 编程助手
- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [Expo](https://expo.dev/) - React Native 平台

---

**用 ❤️ 打造 by CC QwQ 团队**

**正在寻找贡献者！** 如果你对这个项目感兴趣，请在 GitHub 上给我们一个 Star ⭐
