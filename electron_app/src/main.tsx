import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 检测是否在 macOS 上运行，添加平台特定类
if (typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin') {
  document.body.classList.add('platform-macos')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
