# CC QwQ 开源方案设计

**日期**: 2026-02-08
**版本**: 1.0
**状态**: 待实施

## 概述

本文档描述 CC QwQ 项目的开源策略，包括仓库配置、文档国际化、协作流程和推广策略。项目以"早期开发阶段，寻求共同开发者"的定位开源，吸引有相同愿景的开发者共同完善项目。

## 项目定位

**定位标签**: Active Development / Seeking Maintainers

**状态标记**: 🚧 Active Development / Alpha

**核心优势**:
- 透明度高：让潜在贡献者看到项目从零开始的过程
- 灵活性强：在早期阶段更容易接受架构调整和功能变更
- 社区建设：吸引对想法有共鸣的开发者

## 仓库配置

### 核心文件结构

```
CC_QWQ/
├── .github/              # GitHub 专用配置
│   ├── ISSUE_TEMPLATE/   # Issue 模板
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── general_question.md
│   ├── pull_request_template.md  # PR 模板
│   └── workflows/        # CI/CD 工作流（可选）
├── LICENSE               # 开源协议
├── README.md             # 项目主页（英文）
├── README.zh-CN.md       # 项目主页（中文）
├── CONTRIBUTING.md       # 贡献指南
├── CODE_OF_CONDUCT.md    # 行为准则
├── CONTRIBUTORS.md       # 贡献者列表
└── docs/                 # 详细文档
```

### 开源协议选择

**推荐**: MIT License

**理由**:
- 最宽松，允许任何人使用、修改、分发
- 对商业应用友好
- 简单易懂，法律文本短

**备选**: Apache 2.0（如担心被商业公司"白嫖"而不回馈）

### GitHub 仓库设置

**1. Repository Topics**（标签）:
```
claude-code, remote-control, electron, react-native, developer-tools, websocket
```

**2. Branch Protection**（分支保护）:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging

**3. Labels**（Issue 标签）:
| 标签 | 颜色 | 用途 |
|------|------|------|
| `good first issue` | 绿色 | 适合新手的任务 |
| `help wanted` | 蓝色 | 期待帮助 |
| `enhancement` | 紫色 | 新功能 |
| `bug` | 红色 | Bug 修复 |
| `documentation` | 浅蓝 | 文档更新 |
| `priority: high` | 橙色 | 高优先级 |

## 文档国际化

### 国际化策略

**方案 A: 双语言并排（推荐）**
```
README.md (英文为主)
README.zh-CN.md (中文版本)
docs/ 文档同样处理
```
- GitHub 会根据用户语言自动显示对应版本
- 英文作为主版本，确保代码注释和变量名用英文

### README.md 结构

**英文版** (README.md):
```markdown
# CC QwQ 📱💻

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/free-revalution/CC_QWQ)](https://github.com/free-revalution/CC_QWQ/issues)
[![Status: Active Development](https://img.shields.io/badge/Status-Active--Development-yellow)](https://github.com/free-revalution/CC_QWQ)

> Remotely control Claude Code from your phone 🚀

**English** | [简体中文](README.zh-CN.md)

## 🎯 What is CC QwQ?

CC QwQ is a cross-platform application that allows you to interact with Claude Code running on your desktop from your mobile device. Perfect for when you're away from your computer but need to continue coding!

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

### Installation

```bash
# Desktop
cd electron_app
npm install
npm run dev

# Mobile
cd Expo_app
npm install
npx expo start
```

## 🗺️ Roadmap

- [x] Desktop app architecture
- [x] Mobile app architecture
- [ ] Claude Code CLI integration
- [ ] WebSocket communication
- [ ] QR code authentication
- [ ] Release builds

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ by the CC QwQ team
```

**中文版** (README.zh-CN.md): 对应翻译版本

### 其他必要文档

**CONTRIBUTING.md**:
```markdown
# Contributing to CC QwQ

感谢你的关注！以下是贡献指南。

## 开发环境设置

1. Fork 仓库到你的 GitHub 账号
2. 克隆到本地
   ```bash
   git clone https://github.com/<your-username>/CC_QWQ.git
   cd CC_QWQ
   git remote add upstream https://github.com/free-revalution/CC_QWQ.git
   ```
3. 安装依赖
   ```bash
   cd electron_app  # 或 Expo_app
   npm install
   ```
4. 创建分支
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 提交规范

使用语义化提交：
- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

示例：
```bash
git commit -m "feat: add QR code scanning functionality"
```

## Pull Request 流程

1. 确保代码通过 lint 检查
2. 更新相关文档
3. 提交 PR 并填写 PR 模板
4. 等待 maintainer review

## 代码规范

- 遵循现有的代码风格
- 添加必要的注释（英文）
- 确保 TypeScript 类型正确

## 行为准则

保持友善和尊重 🌟

有任何问题欢迎提 Issue！
```

**CODE_OF_CONDUCT.md**: 简单的友善社区准则

## 协作流程

### 分支策略

采用简化的 **GitHub Flow**:

```
main (protected)
  ↑
  └── feature/xxx    - 新功能
  └── bugfix/xxx     - Bug 修复
  └── docs/xxx       - 文档更新
  └── refactor/xxx   - 重构
```

### 开发工作流程

**1. 贡献者流程**:

```bash
# 1. Fork 并克隆
git clone https://github.com/<their-username>/CC_QWQ.git
cd CC_QWQ
git remote add upstream https://github.com/free-revalution/CC_QWQ.git

# 2. 创建功能分支（从 main）
git checkout main
git pull upstream main
git checkout -b feature/add-something

# 3. 开发和提交
git add .
git commit -m "feat: add something descriptive"

# 4. 同步上游最新代码（避免冲突）
git fetch upstream
git rebase upstream/main

# 5. 推送到自己的 fork
git push origin feature/add-something

# 6. 在 GitHub 上创建 Pull Request
```

**2. Maintainer 审核流程**:
- 审查代码变更
- 提出修改建议或直接修改
- 批准并合并到 main
- 删除已合并的分支

### GitHub 模板文件

**.github/pull_request_template.md**:
```markdown
## 描述
简要描述这个 PR 的改动

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 重构
- [ ] 其他

## 测试
描述你如何测试这些改动

## 截图（如适用）
添加截图帮助理解改动

## 相关 Issue
Closes #(issue number)
```

**.github/ISSUE_TEMPLATE/bug_report.md**:
```markdown
---
name: Bug report
about: 报告项目中的问题
title: '[BUG] '
labels: bug
assignees: ''
---

## 描述
清晰简洁地描述 bug

## 复现步骤
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 预期行为
描述你期望发生什么

## 截图
如果适用，添加截图帮助解释问题

## 环境
- OS: [e.g. macOS, Windows, iOS]
- App version: [e.g. 0.1.0]
- Node.js version: [e.g. 18.0.0]

## 附加信息
添加其他相关信息
```

## 推广策略

### 初期推广平台

**1. 开发者社区（首选）**

**GitHub**:
- 完善的 README 和文档
- 设置 "Good First Issue" 标签
- 在 README 中加入 "We're looking for contributors!" 徽章

**Reddit**:
- r/programming - 一般性编程讨论
- r/opensource - 开源项目宣传
- r/Claude - Claude 相关讨论

标题示例:
```
[Open Source] Building a remote control for Claude Code -
seeking contributors! 🚀
```

**2. 中文社区**

**掘金 / V2EX / 知乎**:
- 写一篇"开发日记"类型的文章
- 分享开发过程和遇到的挑战
- 文末附上 GitHub 链接

**Bilibili**:
- 录制 3-5 分钟的项目演示视频
- 展示"手机控制电脑写代码"的酷炫效果

**3. 社交媒体**

**Twitter / X**:
- 标签：#BuildInPublic #ClaudeCode #OpenSource #Electron
- 定期更新开发进展，带截图或短视频

**Hacker News**:
- 投稿到 "Show HN" 版块
- 标题："Show HN: CC QwQ - remote control Claude Code from your phone"

### 推广文案模板

**英文**:
```
Hey everyone! 👋 I'm building CC QwQ - an app that lets you
control Claude Code from your phone. It's still early but I
believe in this vision. Looking for collaborators!
🔗 github.com/free-revalution/CC_QWQ

#BuildInPublic #ClaudeCode #OpenSource
```

**中文**:
```
大家好！👋 我正在开发 CC QwQ - 一个可以用手机远程控制
Claude Code 的应用。项目还在早期阶段，诚邀有兴趣的开发者
一起完善！

🔗 github.com/free-revalution/CC_QWQ
```

### 吸引贡献者的技巧

1. **创建 "Good First Issue"**
   - 标注几个适合新手的简单任务
   - 提供详细的指导和上下文

2. **及时响应**
   - 快速回复 Issue 和 PR
   - 建立友好的社区氛围

3. **公开致谢**
   - 在 CONTRIBUTORS.md 中列出贡献者
   - 在 Release Notes 中感谢

4. **保持透明**
   - 定期更新开发日志
   - 分享项目进展和困难

## 实施步骤

### 第一阶段：仓库准备

1. ✅ 初始化 git 仓库
2. [ ] 创建 LICENSE 文件（MIT）
3. [ ] 创建 README.md（英文版）
4. [ ] 创建 README.zh-CN.md（中文版）
5. [ ] 创建 CONTRIBUTING.md
6. [ ] 创建 CODE_OF_CONDUCT.md
7. [ ] 创建 .github 模板文件
8. [ ] 设置仓库 Topics
9. [ ] 配置 Branch Protection

### 第二阶段：代码准备

1. [ ] 将代码注释和变量名国际化（英文）
2. [ ] 添加 .gitignore（如没有）
3. [ ] 清理敏感信息（API keys、密码等）
4. [ ] 添加 package.json 的 repository 字段

### 第三阶段：发布推广

1. [ ] 推送代码到 GitHub
2. [ ] 创建第一个 Release（v0.1.0-alpha）
3. [ ] 在各平台发布推广内容
4. [ ] 持续维护和响应

## 注意事项

1. **代码质量**: 即使是早期代码，也要保持基本的可读性
2. **文档优先**: 好的文档比完美的代码更能吸引贡献者
3. **友好社区**: 对所有贡献者保持友善和耐心
4. **持续更新**: 定期更新项目状态，即使是小幅进展

## 成功指标

- Fork 数量
- Star 数量
- 活跃贡献者数量
- 合并的 PR 数量
- Issue 响应时间

---

**下一步**: 准备开始实施了吗？我可以帮你创建这些文件。
