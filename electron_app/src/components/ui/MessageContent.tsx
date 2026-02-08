import { useMemo, memo } from 'react'
import CodeBlock from './CodeBlock'

interface MessageContentProps {
  content: string
}

interface ContentSegment {
  type: 'text' | 'code'
  content: string
  language?: string
}

/**
 * 解析消息内容，分离文本和代码块
 * 支持流式输出（不完整的代码块）
 * 支持的代码块格式：
 * ```language
 * code here
 * ```
 */
function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const lines = content.split('\n')
  let inCodeBlock = false
  let currentCodeLanguage = 'typescript'
  let currentCodeLines: string[] = []
  let currentTextLines: string[] = []

  for (const line of lines) {
    // 检测代码块开始
    const codeStartMatch = line.match(/^```(\w*)/)
    if (codeStartMatch && !inCodeBlock) {
      // 先保存之前的文本
      const textContent = currentTextLines.join('\n').trim()
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent
        })
      }
      currentTextLines = []

      // 开始新的代码块
      inCodeBlock = true
      currentCodeLanguage = codeStartMatch[1] || 'typescript'
      currentCodeLines = []
      continue
    }

    // 检测代码块结束
    if (line.trim() === '```' && inCodeBlock) {
      // 结束代码块
      const codeContent = currentCodeLines.join('\n').trim()
      if (codeContent) {
        segments.push({
          type: 'code',
          content: codeContent,
          language: currentCodeLanguage
        })
      }
      currentCodeLines = []
      inCodeBlock = false
      continue
    }

    // 收集内容
    if (inCodeBlock) {
      currentCodeLines.push(line)
    } else {
      currentTextLines.push(line)
    }
  }

  // 处理剩余内容
  if (inCodeBlock) {
    // 不完整的代码块（流式输出中），作为代码块显示
    const codeContent = currentCodeLines.join('\n')
    if (codeContent) {
      segments.push({
        type: 'code',
        content: codeContent,
        language: currentCodeLanguage
      })
    }
  }

  // 添加剩余的文本
  const textContent = currentTextLines.join('\n').trim()
  if (textContent) {
    segments.push({
      type: 'text',
      content: textContent
    })
  }

  // 如果没有任何内容，返回空数组
  if (segments.length === 0 && content.trim()) {
    segments.push({
      type: 'text',
      content: content.trim()
    })
  }

  return segments
}

const MessageContent = memo(function MessageContent({ content }: MessageContentProps) {
  const segments = useMemo(() => parseContent(content), [content])

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          return (
            <CodeBlock
              key={`code-${index}`}
              code={segment.content}
              language={segment.language}
            />
          )
        }

        return (
          <p
            key={`text-${index}`}
            className="text-primary whitespace-pre-wrap break-words leading-relaxed"
          >
            {segment.content}
          </p>
        )
      })}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if the content string has actually changed
  return prevProps.content === nextProps.content
})

export default MessageContent
