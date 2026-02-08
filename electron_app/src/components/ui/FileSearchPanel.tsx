import { useState, useCallback } from 'react'
import { X, Search, FileCode, ExternalLink, AlertCircle } from 'lucide-react'
import { ipc } from '../../lib/ipc'

interface SearchResult {
  file: string
  line: number
  content: string
}

interface FileSearchPanelProps {
  projectPath: string | null
  visible: boolean
  onClose: () => void
  onInsertReference?: (filePath: string, line?: number) => void
}

export default function FileSearchPanel({
  projectPath,
  visible,
  onClose,
  onInsertReference,
}: FileSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!projectPath || !query.trim()) {
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const result = await ipc.searchFiles(projectPath, query.trim())
      if (result.success && result.results) {
        setResults(result.results)
        if (result.results.length === 0) {
          setError('No results found')
        }
      } else {
        setError(result.error || 'Search failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [projectPath, query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch()
    }
  }

  const handleResultClick = (result: SearchResult) => {
    if (onInsertReference) {
      onInsertReference(result.file, result.line)
      onClose()
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background glass-card rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <Search size={20} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-primary">Search File Contents</h2>
            <p className="text-xs text-secondary">{projectPath || 'No project'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 text-secondary hover:text-primary transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="p-4 border-b border-white/10">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter search query..."
                className="w-full px-4 py-2.5 pl-10 glass-card border-0 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary/60" />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {!searched && !loading && (
            <div className="flex items-center justify-center py-12 text-secondary">
              <div className="text-center">
                <Search size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Enter a search query to find content in your project</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-secondary">
                <Search size={20} className="animate-pulse" />
                <span>Searching files...</span>
              </div>
            </div>
          )}

          {error && results.length === 0 && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-secondary">
                  Found <span className="font-medium text-primary">{results.length}</span> results
                  {results.length >= 100 && ' (showing first 100)'}
                </span>
              </div>

              {results.map((result, index) => (
                <div
                  key={`${result.file}-${result.line}-${index}`}
                  className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                  onClick={() => handleResultClick(result)}
                  title={onInsertReference ? 'Click to insert reference' : result.file}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded bg-blue-500/20 shrink-0">
                      <FileCode size={14} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-primary truncate">
                          {result.file}
                        </span>
                        <span className="text-xs text-secondary/70">:{result.line}</span>
                      </div>
                      <pre className="text-xs text-secondary/70 font-mono bg-black/20 p-2 rounded overflow-x-auto">
                        {result.content.trim()}
                      </pre>
                    </div>
                    {onInsertReference && (
                      <ExternalLink
                        size={16}
                        className="text-secondary/50 group-hover:text-blue-500 transition-colors shrink-0"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
