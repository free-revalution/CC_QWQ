import { useState } from 'react'
import ProjectOpenPage from './pages/ProjectOpenPage'
import ConversationPage from './pages/ConversationPage'
import SettingsPage from './pages/SettingsPage'
import { useProjects } from './hooks/useProjects'
import type { PageType } from './types'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('open')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const { projects, addProject, removeProject } = useProjects()

  const handleProjectSelect = (path: string, name: string) => {
    setProjectPath(path)
    addProject(path, name)
    setCurrentPage('conversation')
  }

  const handleRemoveProject = (path: string) => {
    removeProject(path)
  }

  const handleOpenSettings = () => {
    setCurrentPage('settings')
  }

  // 根据当前页面渲染对应组件
  const renderPage = () => {
    switch (currentPage) {
      case 'open':
        return (
          <ProjectOpenPage
            recentProjects={projects}
            onProjectSelect={handleProjectSelect}
            onRemoveProject={handleRemoveProject}
          />
        )
      case 'conversation':
        return (
          <ConversationPage
            projectPath={projectPath}
            onOpenSettings={handleOpenSettings}
          />
        )
      case 'settings':
        return (
          <SettingsPage
            onBack={() => setCurrentPage('conversation')}
          />
        )
      default:
        return null
    }
  }

  return renderPage()
}

export default App
