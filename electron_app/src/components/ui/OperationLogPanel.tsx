import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { ipc } from '../../lib/ipc'
import type { LogEntry, LogLevel, LogCategory } from '../../types/operation'

// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES = 500

// Get display text for log level (pure function, moved outside component)
const getLevelText = (level: LogLevel): string => {
  const levelMap: Record<LogLevel, string> = {
    info: 'Info',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
  }
  return levelMap[level] || level
}

// Get status display for operations
const getStatusDisplay = (status: string): { text: string; className: string } => {
  const statusMap: Record<string, { text: string; className: string }> = {
    pending: { text: '⏳ Pending', className: 'status-pending' },
    awaiting_approval: { text: '🔵 Awaiting Approval', className: 'status-awaiting' },
    running: { text: '🔄 Running', className: 'status-running' },
    completed: { text: '✅ Completed', className: 'status-completed' },
    failed: { text: '❌ Failed', className: 'status-failed' },
    denied: { text: '🚫 Denied', className: 'status-denied' },
  }
  return statusMap[status] || { text: status, className: '' }
}

export const OperationLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<{
    level?: LogLevel[]
    category?: LogCategory[]
    tool?: string[]
  }>({})

  // Auto-scroll state
  const [autoScroll, setAutoScroll] = useState(true)
  const logListRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Calculate log statistics
  const stats = useMemo(() => {
    const byLevel: Record<LogLevel, number> = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
    }
    const byCategory: Record<LogCategory, number> = {
      tool: 0,
      approval: 0,
      system: 0,
      rollback: 0,
    }

    logs.forEach(log => {
      byLevel[log.level]++
      byCategory[log.category]++
    })

    return {
      total: logs.length,
      byLevel,
      byCategory,
    }
  }, [logs])

  // Load historical logs with abort pattern for race condition prevention
  useEffect(() => {
    let isCancelled = false
    const loadLogs = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await ipc.getLogs(filter)
        if (!isCancelled) {
          setLogs(result)
        }
      } catch (err) {
        if (!isCancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load logs'
          setError(errorMessage)
          console.error('Error loading logs:', err)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }
    loadLogs()
    return () => {
      isCancelled = true
    }
  }, [filter])

  // Subscribe to real-time logs with limit enforcement
  useEffect(() => {
    const cleanupId = ipc.onLogEntry((log) => {
      setLogs(prev => {
        const newLogs = [...prev, log]
        // Trim logs to maximum limit to prevent memory issues
        return newLogs.length > MAX_LOG_ENTRIES
          ? newLogs.slice(-MAX_LOG_ENTRIES)
          : newLogs
      })
    })
    return () => ipc.removeListener(cleanupId)
  }, [])

  // Clear logs with error handling
  const handleClear = useCallback(async () => {
    try {
      await ipc.clearLogs()
      setLogs([])
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear logs'
      setError(errorMessage)
      console.error('Error clearing logs:', err)
    }
  }, [])

  // Export logs with error handling
  const handleExport = useCallback(async (format: 'json' | 'text') => {
    try {
      const content = await ipc.exportLogs(format)
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs.${format}`
      a.click()
      URL.revokeObjectURL(url)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export logs'
      setError(errorMessage)
      console.error('Error exporting logs:', err)
    }
  }, [])

  return (
    <div className="operation-log-panel">
      <div className="log-header">
        <div className="log-title-section">
          <h3>Operation Log</h3>
          <div className="log-stats">
            <span className="stat-item">Total: <strong>{stats.total}</strong></span>
            <span className={`stat-item stat-info`}>Info: {stats.byLevel.info}</span>
            <span className={`stat-item stat-success`}>Success: {stats.byLevel.success}</span>
            <span className={`stat-item stat-warning`}>Warning: {stats.byLevel.warning}</span>
            <span className={`stat-item stat-error`}>Error: {stats.byLevel.error}</span>
          </div>
        </div>
        <div className="log-actions">
          <select
            value={filter.level?.[0] || ''}
            onChange={(e) => setFilter({ ...filter, level: e.target.value ? [e.target.value as LogLevel] : undefined })}
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <select
            value={filter.category?.[0] || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value ? [e.target.value as LogCategory] : undefined })}
          >
            <option value="">All Categories</option>
            <option value="tool">Tool</option>
            <option value="approval">Approval</option>
            <option value="system">System</option>
            <option value="rollback">Rollback</option>
          </select>
          <button onClick={handleClear}>Clear</button>
          <button onClick={() => handleExport('json')}>Export JSON</button>
          <button onClick={() => handleExport('text')}>Export Text</button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`auto-scroll-toggle ${autoScroll ? 'active' : ''}`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            {autoScroll ? '🟢' : '⚪'} Auto-scroll
          </button>
        </div>
      </div>

      {/* Display error message */}
      {error && (
        <div className="log-error">
          {error}
        </div>
      )}

      {/* Display loading state */}
      {loading && (
        <div className="log-loading">Loading logs...</div>
      )}

      <div className="log-list" ref={logListRef}>
        {logs.map(log => {
          const statusDisplay = getStatusDisplay(log.status)
          return (
            <div key={log.id} className={`log-item log-${log.level} ${statusDisplay.className}`}>
              <div className="log-meta">
                <span className="log-time">{new Date(log.timestamp).toLocaleString()}</span>
                <span className="log-level">{getLevelText(log.level)}</span>
                {log.status && <span className={`log-status ${statusDisplay.className}`}>{statusDisplay.text}</span>}
                <span className="log-category">{log.category}</span>
                {log.tool && <span className="log-tool">{log.tool}</span>}
              </div>
              <div className="log-title">{log.title}</div>
              <div className="log-message">{log.message}</div>
              {log.details && (
                <pre className="log-details">{JSON.stringify(log.details, null, 2)}</pre>
              )}
              {log.duration && (
                <div className="log-duration">Duration: {log.duration}ms</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
