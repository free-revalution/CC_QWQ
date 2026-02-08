import { useEffect, useState, useMemo } from 'react'
import { codeToHtml } from 'shiki'
import type { bundledLanguages } from 'shiki'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  className?: string
}

// 支持的语言映射
const languageMap: Record<string, keyof typeof bundledLanguages> = {
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'jsx': 'jsx',
  'tsx': 'tsx',
  'python': 'python',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c++': 'cpp',
  'c': 'cpp',
  'csharp': 'csharp',
  'cs': 'csharp',
  'go': 'go',
  'rust': 'rust',
  'rs': 'rust',
  'ruby': 'ruby',
  'rb': 'ruby',
  'php': 'php',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'scala': 'scala',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'json': 'json',
  'xml': 'xml',
  'yaml': 'yaml',
  'yml': 'yaml',
  'markdown': 'md',
  'md': 'md',
  'bash': 'bash',
  'sh': 'bash',
  'shell': 'shell',
  'sql': 'sql',
  'dockerfile': 'docker',
  'docker': 'docker',
}

export default function CodeBlock({ code, language = 'typescript', filename, className = '' }: CodeBlockProps) {
  const [highlightedCode, setHighlightedCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  // 获取规范化的语言
  const normalizedLanguage = useMemo(() => {
    const lang = language.toLowerCase()
    return languageMap[lang] || languageMap[lang.split('/')[0]] || 'typescript'
  }, [language])

  // 高亮代码
  useEffect(() => {
    let mounted = true

    async function highlight() {
      try {
        setLoading(true)
        const html = await codeToHtml(code, {
          lang: normalizedLanguage,
          theme: 'dark-plus'
        })
        if (mounted) {
          setHighlightedCode(html)
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to highlight code:', error)
        if (mounted) {
          // 降级：显示纯文本
          setHighlightedCode(`<pre style="margin:0;padding:16px;overflow-x:auto;"><code style="font-family:'Fira Code','JetBrains Mono',monospace;font-size:14px;line-height:1.5;color:#d4d4d4;">${escapeHtml(code)}</code></pre>`)
          setLoading(false)
        }
      }
    }

    highlight()

    return () => {
      mounted = false
    }
  }, [code, normalizedLanguage])

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className={`relative group rounded-xl overflow-hidden ${className}`} style={{
      backgroundColor: '#1E1E1E',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* 顶部栏 */}
      {(filename || language) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10" style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}>
          <div className="flex items-center gap-2">
            {/* 文件图标 */}
            <div className="w-3 h-3 rounded-full" style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            }} />
            <span className="text-xs text-white/80 font-mono">
              {filename || language}
            </span>
          </div>

          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
            title={copied ? '已复制!' : '复制代码'}
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-white/60" />
            )}
          </button>
        </div>
      )}

      {/* 代码内容 */}
      {loading ? (
        <div className="p-4 text-center">
          <div className="inline-block w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          style={{
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        />
      )}

      {/* 自定义样式 - 覆盖 Shiki 默认样式 */}
      <style>{`
        /* 覆盖 Shiki pre 样式 */
        pre.shiki {
          margin: 0 !important;
          padding: 16px !important;
          background: transparent !important;
        }

        /* 覆盖 Shiki code 样式 */
        pre.shiki code {
          font-family: 'Fira Code', 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 14px;
          line-height: 1.5;
        }

        /* 滚动条样式 */
        div::-webkit-scrollbar {
          height: 8px;
        }

        div::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }

        div::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  )
}

// HTML 转义工具函数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
