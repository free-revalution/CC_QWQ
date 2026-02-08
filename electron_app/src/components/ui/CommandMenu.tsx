import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Settings, FileText, Trash2, Zap, BarChart3, CircleHelp, Sparkles, Server, Cpu } from 'lucide-react'
import { ipc } from '../../lib/ipc'

interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  group?: string
}

interface CommandGroup {
  title: string
  commands: Command[]
}

interface CommandMenuProps {
  isVisible: boolean
  position: { top: number; left: number; width: number; height: number }
  onSelect: (command: string) => void
  onClose: () => void
}

// 基础命令组
const baseCommandGroups: CommandGroup[] = [
  {
    title: 'Context',
    commands: [
      { id: '/attach', label: 'Attach file...', description: '附加文件到对话', icon: <FileText size={16} /> },
      { id: '/clear', label: 'Clear conversation', description: '清空当前对话', icon: <Trash2 size={16} /> },
    ],
  },
  {
    title: 'Model',
    commands: [
      { id: '/model', label: 'Switch model...', description: '切换 AI 模型', icon: <Settings size={16} /> },
      { id: '/thinking', label: 'Toggle thinking mode', description: '切换思考模式', icon: <Zap size={16} /> },
      { id: '/usage', label: 'Account & usage', description: '查看账户和使用情况', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: 'Slash Commands',
    commands: [
      { id: '/help', label: 'Show help', description: '显示帮助信息', icon: <CircleHelp size={16} /> },
      { id: '/settings', label: 'Open settings', description: '打开设置页面', icon: <Settings size={16} /> },
    ],
  },
]

export default function CommandMenu({
  isVisible,
  position,
  onSelect,
  onClose,
}: CommandMenuProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const [dynamicGroups, setDynamicGroups] = useState<CommandGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 加载 skills 和 MCP 服务器
  useEffect(() => {
    if (!isVisible) return

    const loadDynamicCommands = async () => {
      setIsLoading(true)
      const groups: CommandGroup[] = []

      try {
        // 加载 Skills
        const skillsResult = await ipc.getSkills()
        if (skillsResult.success && skillsResult.skills && skillsResult.skills.length > 0) {
          groups.push({
            title: 'Skills',
            commands: skillsResult.skills.map((skill: { name: string; path: string; description?: string }) => ({
              id: `/skill ${skill.name}`,
              label: skill.name,
              description: skill.description || `使用 ${skill.name} 技能`,
              icon: <Sparkles size={16} />,
            })),
          })
        }

        // 加载 MCP 服务器
        const mcpResult = await ipc.getMCPServers()
        if (mcpResult.success && mcpResult.servers && mcpResult.servers.length > 0) {
          groups.push({
            title: 'MCP Servers',
            commands: mcpResult.servers.map((server: { name: string; command: string; args?: string[] }) => ({
              id: `/mcp ${server.name}`,
              label: server.name,
              description: `使用 ${server.name} MCP 服务器`,
              icon: <Server size={16} />,
            })),
          })
        }
      } catch (error) {
        console.error('Failed to load dynamic commands:', error)
      } finally {
        setIsLoading(false)
      }

      setDynamicGroups(groups)
    }

    loadDynamicCommands()
  }, [isVisible])

  // 合并基础命令和动态命令
  const allCommandGroups = useCallback((): CommandGroup[] => {
    return [...baseCommandGroups, ...dynamicGroups]
  }, [dynamicGroups])

  // 获取过滤后的命令列表 - 必须在 useEffect 之前定义
  const getFilteredCommands = useCallback((): Command[] => {
    const allCommands: Command[] = []
    for (const group of allCommandGroups()) {
      for (const cmd of group.commands) {
        if (cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cmd.id.toLowerCase().includes(searchQuery.toLowerCase())) {
          allCommands.push(cmd)
        }
      }
    }
    return allCommands
  }, [searchQuery, allCommandGroups])

  const filteredCommands = getFilteredCommands()

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % getFilteredCommands().length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + getFilteredCommands().length) % getFilteredCommands().length)
          break
        case 'Enter': {
          e.preventDefault()
          const commands = getFilteredCommands()
          if (commands[selectedIndex]) {
            onSelect(commands[selectedIndex].id)
            onClose()
          }
          break
        }
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab': {
          e.preventDefault()
          // Tab 补全当前选中的命令
          const cmd = getFilteredCommands()[selectedIndex]
          if (cmd) {
            onSelect(cmd.id)
            onClose()
          }
          break
        }
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, selectedIndex, onSelect, onClose, getFilteredCommands])

  // 选择命令
  const handleSelectCommand = (command: Command, index: number) => {
    setSelectedIndex(index)
    onSelect(command.id)
    onClose()
  }

  if (!isVisible) return null

  return (
    <>
      {/* 覆盖层 - 点击关闭 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 菜单 */}
      <div
        ref={menuRef}
        className="fixed z-50 glass-card p-3 min-w-72 max-w-md overflow-hidden flex flex-col"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
          height: `${position.height}px`,
        }}
        onClick={(e) => e.stopPropagation()} // 阻止事件冒泡到覆盖层
      >
        {/* 搜索框 */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="搜索命令..."
            className="w-full px-4 py-2 pl-10 glass-card border-0 text-sm focus:outline-none"
            autoFocus
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/60 text-lg">
            🔍
          </span>
        </div>

        {/* 命令列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-secondary text-sm">
              <Cpu size={16} className="animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              未找到匹配的命令
            </div>
          ) : (
            <div className="space-y-0.5">
              {allCommandGroups().map((group) => {
                const groupCommands = group.commands.filter(
                  (cmd) =>
                    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    cmd.id.toLowerCase().includes(searchQuery.toLowerCase())
                )

                if (groupCommands.length === 0) return null

                let globalIndex = 0
                return (
                  <div key={group.title}>
                    <div className="text-xs text-secondary uppercase tracking-wider mb-1 mt-2 first:mt-0 px-3 py-1">
                      {group.title}
                    </div>
                    {groupCommands.map((command) => {
                      const index = globalIndex++
                      const isSelected = index === selectedIndex

                      return (
                        <button
                          key={command.id}
                          onClick={() => handleSelectCommand(command, index)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3 ${
                            isSelected
                              ? 'bg-blue-500/20 text-blue-600'
                              : 'hover:bg-white/20 text-primary'
                          }`}
                        >
                          {command.icon || <Terminal size={16} className="text-secondary" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{command.label}</div>
                            {command.description && (
                              <div className="text-xs text-secondary truncate">{command.description}</div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 快捷键提示 */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-secondary px-3">
          <span>ESC 关闭</span>
          <span>↑↓ 导航</span>
          <span>Enter 确认</span>
        </div>
      </div>
    </>
  )
}
