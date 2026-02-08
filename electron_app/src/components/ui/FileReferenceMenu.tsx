import { useState, useEffect, useRef, useCallback } from 'react'
import { File, Folder, ChevronRight, Loader2 } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

interface FileReferenceMenuProps {
  isVisible: boolean
  position: { top: number; left: number; width: number; height: number }
  onSelect: (path: string) => void
  onClose: () => void
  projectPath: string | null
}

export default function FileReferenceMenu({
  isVisible,
  position,
  onSelect,
  onClose,
  projectPath,
}: FileReferenceMenuProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 加载文件树
  const loadFileTree = useCallback(async () => {
    if (!projectPath) {
      setError('请先选择项目文件夹')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI?.readDirectory(projectPath)
      if (result?.success && result.tree) {
        setFileTree(result.tree)
      } else {
        setError(result?.error || '读取目录失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取目录失败')
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  // 当菜单显示时加载文件树
  useEffect(() => {
    if (isVisible) {
      loadFileTree()
    }
  }, [isVisible, loadFileTree])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, onClose])

  // 切换文件夹展开状态
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // 过滤文件树
  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes

    const filtered: FileNode[] = []
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        filtered.push(node)
      } else if (node.children) {
        const filteredChildren = filterTree(node.children, query)
        if (filteredChildren.length > 0) {
          filtered.push({ ...node, children: filteredChildren })
        }
      }
    }
    return filtered
  }, [])

  const filteredTree = filterTree(fileTree, searchQuery)

  // 渲染文件树节点
  const renderNode = (node: FileNode, depth: number = 0): React.ReactElement => {
    const isExpanded = expandedFolders.has(node.path)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-white/20 rounded-lg cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleFolder(node.path)
            } else {
              onSelect(node.path)
              onClose()
            }
          }}
        >
          {hasChildren ? (
            <ChevronRight
              size={14}
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          ) : null}
          {node.type === 'folder' ? (
            <Folder size={16} className="text-blue-500" />
          ) : (
            <File size={16} className="text-secondary" />
          )}
          <span className="text-sm text-primary">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
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
        className="fixed z-50 glass-card p-4 min-w-80 max-w-md overflow-hidden flex flex-col"
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件..."
            className="w-full px-4 py-2 pl-10 glass-card border-0 text-sm focus:outline-none"
            autoFocus
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/60 text-lg">
            🔍
          </span>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-hide">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-secondary text-sm gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>加载文件树...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">
              {error}
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              {searchQuery ? '未找到匹配的文件' : '目录为空'}
            </div>
          ) : (
            filteredTree.map((node) => renderNode(node))
          )}
        </div>

        {/* 快捷键提示 */}
        {searchQuery === '' && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-secondary px-3">
            <span>ESC 关闭</span>
            <span>点击文件选择</span>
          </div>
        )}
      </div>
    </>
  )
}
