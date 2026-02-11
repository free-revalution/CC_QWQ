/**
 * TimelinePanel - 时间线面板组件
 *
 * 可折叠侧边面板，显示操作历史时间线
 */

import './TimelinePanel.css'
import { useState, useEffect, useMemo } from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, Hourglass, ChevronDown, ChevronRight } from 'lucide-react'
import { ipc } from '../../lib/ipc'
import type { LogEntry, OperationStatus } from '../../types/operation'

interface TimelinePanelProps {
  className?: string
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({ className = '' }) => {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [filter, setFilter] = useState<{
    status?: OperationStatus[]
    tool?: string[]
  }>({})

  // 加载历史日志
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await ipc.getLogs(filter)
        setEntries(logs)
      } catch (error) {
        console.error('Failed to load timeline entries:', error)
      }
    }
    loadLogs()
  }, [filter])

  // 订阅实时日志
  useEffect(() => {
    const cleanupId = ipc.onLogEntry((log) => {
      setEntries(prev => [...prev, log].slice(-100)) // 保留最近100条
    })
    return () => ipc.removeListener(cleanupId)
  }, [])

  // 计算统计信息
  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    entries.forEach(entry => {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1
    })
    return {
      total: entries.length,
      byStatus
    }
  }, [entries])

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      pending: <Hourglass size={14} className="text-yellow-400" />,
      approved: <CheckCircle size={14} className="text-blue-400" />,
      denied: <XCircle size={14} className="text-red-400" />,
      success: <CheckCircle size={14} className="text-green-400" />,
      error: <XCircle size={14} className="text-red-400" />,
      completed: <CheckCircle size={14} className="text-green-400" />,
      awaiting_approval: <AlertCircle size={14} className="text-orange-400" />,
      running: <Clock size={14} className="text-blue-400 animate-pulse" />
    }
    return iconMap[status] || <Clock size={14} />
  }

  // 生成参数摘要
  const summarizeParams = (details: unknown): string => {
    if (!details || typeof details !== 'object') return ''
    const obj = details as Record<string, unknown>
    const parts: string[] = []

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'content') {
        const str = String(value)
        parts.push(`${key}: ${str.length > 30 ? str.slice(0, 30) + '...' : str}`)
      } else {
        const str = JSON.stringify(value)
        parts.push(`${key}: ${str.length > 30 ? str.slice(0, 30) + '...' : str}`)
      }
      if (parts.join(', ').length > 80) break
    }

    return parts.join(', ')
  }

  return (
    <div className={`timeline-panel ${isCollapsed ? 'collapsed' : ''} ${className}`}>
      {/* 头部 */}
      <div className="timeline-header">
        <div className="timeline-title">
          <Clock size={16} />
          <span>时间线</span>
          <span className="timeline-count">{stats.total}</span>
        </div>
        <button
          className="timeline-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? '展开' : '折叠'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* 内容区域 */}
      {!isCollapsed && (
        <>
          {/* 过滤器 */}
          <div className="timeline-filters">
            <select
              value={filter.status?.[0] || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value ? [e.target.value] : undefined })}
            >
              <option value="">全部状态</option>
              <option value="success">成功</option>
              <option value="error">失败</option>
              <option value="pending">等待中</option>
            </select>
          </div>

          {/* 时间线列表 */}
          <div className="timeline-list">
            {entries.map((entry) => (
              <div key={entry.id} className={`timeline-item status-${entry.status}`}>
                <div className="timeline-item-time">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div className="timeline-item-icon">
                  {getStatusIcon(entry.status)}
                </div>
                <div className="timeline-item-content">
                  <div className="timeline-item-tool">{entry.tool || 'System'}</div>
                  <div className="timeline-item-message">{entry.title}</div>
                  {entry.details && (
                    <div className="timeline-item-details">
                      {String(summarizeParams(entry.details))}
                    </div>
                  )}
                  {entry.duration && (
                    <div className="timeline-item-duration">{entry.duration}ms</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default TimelinePanel
