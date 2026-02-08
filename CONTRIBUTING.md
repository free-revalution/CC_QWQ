# Contributing to CC QwQ

感谢你对 CC QwQ 的关注！我们欢迎任何形式的贡献。

## 🚀 Getting Started

### 1. Fork the Repository

Click the "Fork" button in the top-right corner of [CC QwQ repository](https://github.com/free-revalution/CC_QWQ).

### 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/CC_QWQ.git
cd CC_QWQ
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/free-revalution/CC_QWQ.git
```

### 4. Install Dependencies

**Desktop:**
```bash
cd electron_app
npm install
```

**Mobile:**
```bash
cd Expo_app
npm install
```

## 📝 Development Workflow

### Create a Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
# or: git checkout -b bugfix/your-bugfix
# or: git checkout -b docs/your-doc-update
```

### Make Changes

- Write clear, concise code
- Follow existing code style
- Add comments for complex logic (in English)

### Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add QR code scanning functionality"
git commit -m "fix: resolve WebSocket connection timeout"
git commit -m "docs: update installation instructions"
```

**Commit Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Build process or auxiliary tool changes

### Sync with Upstream

Before creating a PR, sync with the upstream repository:

```bash
git fetch upstream
git rebase upstream/main
```

### Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then go to GitHub and create a Pull Request.

## 🎨 Code Style

### General Guidelines

- Use **English** for variable names, function names, and comments
- Follow existing code style in the project
- Keep functions small and focused
- Write meaningful commit messages

### TypeScript

- Use TypeScript for type safety
- Avoid `any` type when possible
- Define clear interfaces for data structures

### React

- Use functional components with hooks
- Follow React best practices
- Keep components small and reusable

## 📋 Pull Request Guidelines

### PR Title

Use conventional commit format:
- `feat: Add feature description`
- `fix: Fix bug description`

### PR Description

Include:
- **What** changes were made
- **Why** these changes are needed
- **How** you tested the changes
- **Screenshots** for UI changes (if applicable)

### Before Submitting

- [ ] Code compiles without errors
- [ ] New code is tested (manual or automated)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions

## 🐛 Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) when reporting issues.

Please include:
- Clear description of the bug
- Steps to reproduce
- Expected behavior
- Environment details (OS, app version, Node.js version)
- Screenshots if applicable

## 💡 Feature Requests

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) for suggesting new features.

## 🤝 Code of Conduct

Be respectful, inclusive, and collaborative. We're all here to build something cool together!

## 📧 Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing [documentation](README.md)

## 🙏 Thank You

Every contribution, no matter how small, is valuable. Thank you for helping make CC QwQ better! 🌟
