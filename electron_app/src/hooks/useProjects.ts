import { useState, useCallback } from 'react'
import type { Project } from '../types'
import { getRecentProjects, saveRecentProjects } from '../lib/storage'

const MAX_RECENT_PROJECTS = 20 // 最大最近项目数

/**
 * 从 localStorage 加载并验证项目数据
 */
function loadProjects(): Project[] {
  try {
    const stored = getRecentProjects()
    // 验证数据格式并过滤无效数据
    const validProjects = stored
      .filter((item): item is Project => {
        return (
          typeof item === 'object' &&
          item !== null &&
          'path' in item &&
          'name' in item &&
          'lastOpened' in item &&
          typeof (item as { path: unknown }).path === 'string' &&
          typeof (item as { name: unknown }).name === 'string' &&
          typeof (item as { lastOpened: unknown }).lastOpened === 'number'
        )
      })
      .sort((a, b) => b.lastOpened - a.lastOpened) // 按时间倒序
    return validProjects
  } catch {
    return []
  }
}

/**
 * 项目管理 Hook
 * 管理最近项目列表的读取、保存和更新
 */
export function useProjects() {
  // 初始化时直接从 localStorage 加载
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())

  /**
   * 添加或更新项目
   */
  const addProject = useCallback((path: string, name: string) => {
    const now = Date.now()
    const newProject: Project = { path, name, lastOpened: now }

    setProjects((prev) => {
      // 移除已存在的同名项目
      const filtered = prev.filter((p) => p.path !== path)

      // 添加新项目到开头
      const updated = [newProject, ...filtered].slice(0, MAX_RECENT_PROJECTS)
      saveRecentProjects(updated)
      return updated
    })
  }, [])

  /**
   * 移除项目
   */
  const removeProject = useCallback((path: string) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.path !== path)
      saveRecentProjects(updated)
      return updated
    })
  }, [])

  /**
   * 清空所有项目
   */
  const clearProjects = useCallback(() => {
    setProjects([])
    saveRecentProjects([])
  }, [])

  return {
    projects,
    addProject,
    removeProject,
    clearProjects,
  }
}
