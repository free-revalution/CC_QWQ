import { useState, useEffect, useCallback } from 'react'
import { X, GitBranch, GitCommit, RefreshCw, Clock, FileWarning, CheckCircle } from 'lucide-react'
import { ipc } from '../../lib/ipc'

interface GitInfo {
  currentBranch: string
  branches: string[]
  status: string
  commits: Array<{
    hash: string
    message: string
    author: string
    date: string
  }>
}

interface GitStatusPanelProps {
  projectPath: string | null
  visible: boolean
  onClose: () => void
}

export default function GitStatusPanel({ projectPath, visible, onClose }: GitStatusPanelProps) {
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGitStatus = useCallback(async () => {
    if (!projectPath) {
      setError('No project selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await ipc.getGitStatus(projectPath)
      if (result.success && result.git) {
        setGitInfo(result.git)
      } else {
        setError(result.error || 'Failed to load Git status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    if (visible) {
      loadGitStatus()
    }
  }, [visible, loadGitStatus])

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background glass-card rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
              <GitBranch size={20} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Git Status</h2>
              <p className="text-xs text-secondary">{projectPath || 'No project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadGitStatus}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading && !gitInfo && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-secondary">
                <RefreshCw size={20} className="animate-spin" />
                <span>Loading Git status...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 text-red-500">
                <FileWarning size={18} />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {gitInfo && (
            <div className="space-y-4">
              {/* 当前分支 */}
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch size={16} className="text-orange-500" />
                  <span className="text-sm font-medium text-secondary">Current Branch</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1.5 rounded-md bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-500 text-sm font-mono">
                    {gitInfo.currentBranch}
                  </code>
                  {gitInfo.status === '' && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs">
                      <CheckCircle size={12} />
                      Clean
                    </span>
                  )}
                  {gitInfo.status !== '' && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-xs">
                      <FileWarning size={12} />
                      Modified
                    </span>
                  )}
                </div>
              </div>

              {/* 工作区状态 */}
              {gitInfo.status !== '' && (
                <div className="p-3 rounded-lg bg-white/5">
                  <div className="text-sm font-medium text-secondary mb-2">Working Directory</div>
                  <pre className="text-xs text-secondary/70 font-mono whitespace-pre-wrap bg-black/20 p-3 rounded-md overflow-x-auto">
                    {gitInfo.status || 'No changes'}
                  </pre>
                </div>
              )}

              {/* 所有分支 */}
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-sm font-medium text-secondary mb-2">All Branches</div>
                <div className="flex flex-wrap gap-2">
                  {gitInfo.branches.map((branch) => (
                    <span
                      key={branch}
                      className={`px-3 py-1 rounded-md text-sm font-mono ${
                        branch === gitInfo.currentBranch
                          ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-500 border border-orange-500/30'
                          : 'bg-white/5 text-secondary/70 border border-white/10'
                      }`}
                    >
                      {branch.replace('* ', '').trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* 最近提交 */}
              <div className="p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <GitCommit size={16} className="text-secondary" />
                  <span className="text-sm font-medium text-secondary">Recent Commits</span>
                </div>
                <div className="space-y-2">
                  {gitInfo.commits.map((commit) => (
                    <div
                      key={commit.hash}
                      className="p-3 rounded-md bg-black/20 hover:bg-black/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-primary font-medium truncate">{commit.message}</div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-secondary/70">
                            <span>{commit.author}</span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {commit.date}
                            </span>
                          </div>
                        </div>
                        <code className="text-xs text-secondary/50 font-mono shrink-0">
                          {commit.hash.slice(0, 8)}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
