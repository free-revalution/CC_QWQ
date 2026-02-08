# CC QwQ 📱💻

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/free-revalution/CC_QWQ)](https://github.com/free-revalution/CC_QWQ/issues)
[![Status: Active Development](https://img.shields.io/badge/Status-Active--Development-yellow)](https://github.com/free-revalution/CC_QWQ)

> Remotely control Claude Code from your phone 🚀

**English** | [简体中文](README.zh-CN.md)

## 🎯 What is CC QwQ?

CC QwQ is a cross-platform application that allows you to interact with [Claude Code](https://code.anthropic.com) running on your desktop from your mobile device. Perfect for when you're away from your computer but need to continue coding!

## ✨ Features

- 🖥️ **Desktop App** (Electron): Full Claude Code interface integration
- 📱 **Mobile App** (React Native): Remote control via QR code connection
- 🔒 **Secure**: Password-protected local network connection
- 🌐 **Real-time**: WebSocket-based instant communication

## ⚠️ Status

This project is in **active development**. We are looking for contributors to help build the vision!

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Desktop App

```bash
cd electron_app
npm install
npm run dev
```

### Mobile App

```bash
cd Expo_app
npm install
npx expo start
```

Scan the QR code with Expo Go app on your mobile device.

## 🏗️ Architecture

- **Desktop**: Electron + React 19 + Vite + Tailwind CSS
- **Mobile**: Expo + React Native + WebSocket
- **Communication**: WebSocket server on desktop, client on mobile

See [Architecture Docs](docs/) for detailed design.

## 🗺️ Roadmap

- [x] Desktop app architecture design
- [x] Mobile app architecture design
- [ ] Claude Code CLI integration
- [ ] WebSocket communication layer
- [ ] QR code authentication
- [ ] UI implementation
- [ ] Release builds

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📖 Documentation

- [Desktop Architecture Design](docs/plans/2026-01-31-desktop-architecture-design.md)
- [Mobile Architecture Design](docs/plans/2026-01-31-mobile-architecture-design.md)
- [Open Source Strategy](docs/plans/2026-02-08-open-source-design.md)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Claude Code](https://code.anthropic.com) - AI pair programmer
- [Electron](https://www.electronjs.org/) - Desktop framework
- [Expo](https://expo.dev/) - React Native platform

---

**Made with ❤️ by the CC QwQ team**

**We're looking for contributors!** ⭐ Star us on GitHub if you find this project interesting!
