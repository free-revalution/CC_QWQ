import { useState } from 'react'
import { FolderOpen, Trash2, Clock, Sparkles, Zap, Code2, TestTube } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { ipc } from '../lib/ipc'
import type { Project } from '../types'

// 检测是否在浏览器环境（没有 Electron API）
const isBrowser = typeof window !== 'undefined' && !window.electronAPI

interface ProjectOpenPageProps {
  recentProjects: Project[]
  onProjectSelect: (path: string, name: string) => void
  onRemoveProject?: (path: string) => void
}

export default function ProjectOpenPage({
  recentProjects,
  onProjectSelect,
  onRemoveProject,
}: ProjectOpenPageProps) {
  const [isOpening, setIsOpening] = useState(false)

  const handleOpenFolder = async () => {
    // 浏览器环境：使用测试模式
    if (isBrowser) {
      const testPath = '/Users/jiang/development/claudphone/electron_app'
      const testName = 'electron_app (测试)'
      onProjectSelect(testPath, testName)
      return
    }

    // Electron 环境：打开文件夹选择器
    setIsOpening(true)
    try {
      const path = await ipc.openFolder()
      if (path) {
        const name = path.split('/').pop() || path
        onProjectSelect(path, name)
      }
    } catch (error) {
      console.error('Failed to open folder:', error)
    } finally {
      setIsOpening(false)
    }
  }

  const handleProjectClick = (project: Project) => {
    onProjectSelect(project.path, project.name)
  }

  const stats = [
    { label: 'Total Projects', value: recentProjects.length, icon: FolderOpen, gradient: 'gradient-text' },
    { label: 'Active Today', value: Math.min(recentProjects.length, 3), icon: Zap, gradient: 'gradient-text-warm' },
    { label: 'Code Sessions', value: recentProjects.length * 12, icon: Code2, gradient: 'gradient-text-cool' },
  ]

  return (
    <div className="h-full w-full overflow-auto relative">
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-tr from-pink-500/10 to-orange-500/10 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* 顶部欢迎区域 */}
        <div className="text-center mb-16">
          {/* 大号标题 */}
          <h1 className="text-7xl md:text-8xl font-bold tracking-tight mb-6">
            <span className="gradient-text">CC</span>{' '}
            <span className="text-primary">QwQ</span>
          </h1>

          {/* 副标题 */}
          <p className="text-xl md:text-2xl text-secondary mb-8">
            Hello everyone! 让 AI 助力你的代码创作
          </p>

          {/* 主按钮 */}
          <Button
            variant="primary"
            size="lg"
            icon={isBrowser ? TestTube : FolderOpen}
            onClick={handleOpenFolder}
            loading={isOpening}
            className="pulse-glow"
          >
            {isOpening ? 'Opening...' : isBrowser ? '进入测试模式' : 'Open Folder'}
          </Button>

          {/* 浏览器环境提示 */}
          {isBrowser && (
            <p className="text-sm text-secondary/60 mt-4">
              💡 浏览器模式：使用模拟项目路径进行功能测试
            </p>
          )}
        </div>

        {/* Bento Grid 布局 */}
        <div className="bento-grid mb-16">
          {/* 统计卡片 - 跨2列 */}
          {stats.map((stat, index) => (
            <div key={stat.label} className="bento-item" style={{ animationDelay: `${index * 100}ms` }}>
              <Card className="h-full p-6 group cursor-default">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-white/50 to-white/20">
                    <stat.icon size={24} className="text-secondary" />
                  </div>
                  <Sparkles size={16} className="text-secondary/40 group-hover:text-secondary/60 transition-colors" />
                </div>
                <div className={`text-5xl font-bold mb-2 ${stat.gradient}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-secondary/80">{stat.label}</div>
              </Card>
            </div>
          ))}

          {/* 欢迎提示卡片 - 跨4列 */}
          <div className="bento-item" style={{ gridColumn: 'span 12' }}>
            <Card className="h-full p-8 relative overflow-hidden group">
              {/* 背景渐变装饰 */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-primary mb-3">
                    {isBrowser ? '浏览器测试模式' : '开始新的代码之旅'}
                  </h3>
                  <p className="text-secondary mb-6 max-w-xl">
                    {isBrowser
                      ? '在浏览器中测试 UI 界面和交互功能。完整功能请使用桌面版应用。'
                      : '选择一个文件夹，让 Claude Code 成为你最强大的编程伙伴。支持代码补全、bug修复、架构设计等功能。'
                    }
                  </p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>实时协作</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>智能分析</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>多语言支持</span>
                    </div>
                  </div>
                </div>

                {/* 装饰性图标 */}
                <div className="hidden lg:block">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-2xl" />
                    <Code2 size={120} className="relative text-primary/10" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 最近项目区域 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-primary mb-2">Recent Projects</h2>
            <p className="text-secondary">快速访问你最近的项目</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Clock size={16} />
            <span>按时间排序</span>
          </div>
        </div>

        {/* 项目网格 */}
        {recentProjects.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="p-6 rounded-full bg-gradient-to-br from-white/50 to-white/20">
                {isBrowser ? (
                  <TestTube size={48} className="text-secondary/40" />
                ) : (
                  <FolderOpen size={48} className="text-secondary/40" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">
                  {isBrowser ? '浏览器测试环境' : '暂无最近项目'}
                </h3>
                <p className="text-secondary">
                  {isBrowser
                    ? '点击上方按钮进入测试模式预览界面'
                    : '点击上方按钮打开一个文件夹开始'
                  }
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map((project, index) => (
              <Card
                key={project.path}
                className="group cursor-pointer p-5 hover:scale-[1.02] transition-all duration-300"
                onClick={() => handleProjectClick(project)}
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 80}ms both`,
                }}
              >
                {/* 顶部：图标和删除按钮 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all">
                    <FolderOpen size={24} className="text-secondary group-hover:text-primary transition-colors" />
                  </div>
                  {onRemoveProject && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveProject(project.path)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-secondary hover:text-red-500 transition-all"
                      aria-label="Remove project"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* 项目名称 */}
                <h3 className="font-semibold text-primary text-lg mb-2 truncate group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 group-hover:bg-clip-text transition-all">
                  {project.name}
                </h3>

                {/* 项目路径 */}
                <p className="text-sm text-secondary truncate mb-4 font-mono">
                  {project.path}
                </p>

                {/* 底部装饰 */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-500/60" />
                  </div>
                  <div className="text-xs text-secondary/60">点击打开</div>
                </div>

                {/* 微光效果 */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div className="shimmer absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-16 text-center">
          <p className="text-sm text-secondary/60">
            {isBrowser
              ? '💡 浏览器模式仅用于 UI 测试，完整功能请使用桌面版'
              : '提示：你可以拖放文件夹到窗口来快速打开项目'
            }
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
