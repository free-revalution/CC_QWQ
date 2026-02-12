import { useMemo, memo, useState, useCallback } from 'react'
import CodeBlock from './CodeBlock'
import { ChevronDown, ChevronRight, Brain, Copy, Check } from 'lucide-react'

interface MessageContentProps {
  content: string
}

interface TextSpan {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  link?: { text: string; url: string }
}

interface ContentSegment {
  type: 'text' | 'code' | 'thinking' | 'list' | 'numberedList' | 'header'
  language?: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  items?: string[] | ListItem[]
  spans?: TextSpan[]
  content?: string
}

interface ListItem {
  number: number
  text: string
}

/**
 * 解析行内样式（bold, italic, code, links）
 */
function parseSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = []
  let remaining = text

  // Regex patterns for inline styles
  const patterns = {
    boldItalic: /\*\*\*(.+?)\*\*\*/,
    bold: /\*\*(.+?)\*\*/,
    italic: /\*(.+?)\*/,
    code: /`([^`]+)`/,
    link: /\[([^\]]+)\]\(([^)]+)\)/,
  }

  while (remaining.length > 0) {
    let earliestMatch: { type: string; match: RegExpMatchArray; index: number } | null = null

    // Find the earliest match
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = remaining.match(pattern)
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { type, match, index: match.index }
        }
      }
    }

    if (earliestMatch) {
      // Add any text before the match as plain text
      if (earliestMatch.index > 0) {
        spans.push({ text: remaining.slice(0, earliestMatch.index) })
      }

      const { type, match } = earliestMatch
      const fullMatch = match[0]
      const content = match[1]

      if (type === 'boldItalic') {
        spans.push({ text: content, bold: true, italic: true })
      } else if (type === 'bold') {
        spans.push({ text: content, bold: true })
      } else if (type === 'italic') {
        spans.push({ text: content, italic: true })
      } else if (type === 'code') {
        spans.push({ text: content, code: true })
      } else if (type === 'link') {
        spans.push({ link: { text: content, url: match[2] } })
      }

      remaining = remaining.slice(earliestMatch.index + fullMatch.length)
    } else {
      // No more matches, add remaining text
      if (remaining.length > 0) {
        spans.push({ text: remaining })
      }
      break
    }
  }

  return spans.length > 0 ? spans : [{ text }]
}

/**
 * 渲染行内样式文本
 */
function RenderSpans({ spans }: { spans: TextSpan[] }) {
  return (
    <>
      {spans.map((span, index) => {
        if (span.link) {
          return (
            <a
              key={index}
              href={span.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              {span.link.text}
            </a>
          )
        }

        let className = ''
        if (span.bold) className += ' font-semibold'
        if (span.italic) className += ' italic'
        if (span.code) {
          return (
            <code
              key={index}
              className="px-1.5 py-0.5 rounded bg-gray-200/80 text-gray-800 font-mono text-sm"
            >
              {span.text}
            </code>
          )
        }

        return (
          <span key={index} className={className || undefined}>
            {/* @ts-ignore link.text - TypeScript 类型检查问题 */}
            {span.text}
          </span>
        )
      })}
    </>
  )
}

/**
 * 思考块组件
 */
function ThinkingBlock({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [content])

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-purple-200/50 bg-purple-50/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-purple-500" />
          <span className="text-sm font-medium text-purple-700">思考过程</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            className="p-1 rounded hover:bg-purple-200/50 transition-colors"
            title={copied ? '已复制!' : '复制'}
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} className="text-purple-400" />
            )}
          </button>
          {isExpanded ? (
            <ChevronDown size={16} className="text-purple-400" />
          ) : (
            <ChevronRight size={16} className="text-purple-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="text-sm text-purple-800/80 whitespace-pre-wrap leading-relaxed font-mono">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 列表块组件
 */
function ListBlock({ items, ordered = false }: { items: ListItem[]; ordered?: boolean }) {
  return (
    <div className="my-2 space-y-1">
      {items.map((item, index) => {
        const spans = parseSpans(item.text)

        return (
          <div key={index} className="flex gap-2 text-primary">
            <span className="text-secondary flex-shrink-0">
              {ordered ? `${item.number}.` : '•'}
            </span>
            <span className="flex-1">
              <RenderSpans spans={spans} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 标题块组件
 */
function HeaderBlock({ level, spans }: { level: number; spans: TextSpan[] }) {
  const sizes: Record<number, string> = {
    1: 'text-2xl font-bold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-semibold',
    4: 'text-base font-semibold',
    5: 'text-sm font-semibold',
    6: 'text-sm font-medium',
  }

  // 使用 React.createElement 创建标题元素，避免类型问题
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  return (
    <Tag className={`${sizes[level]} text-primary mt-4 mb-2 first:mt-0`}>
      <RenderSpans spans={spans} />
    </Tag>
  )
}

/**
 * 检测是否是权限选项行（应该被过滤掉，由 PermissionRequestDialog 处理）
 */
function isPermissionOptionLine(line: string): boolean {
  const trimmed = line.trim()
  // 匹配 "❯ 1. Yes", "❯ 2. Yes, and don't ask again", "❯ Type here..." 等格式
  if (trimmed.match(/^❯\s*\d+\.\s/)) return true
  if (trimmed.match(/^❯\s*Type\s/i)) return true
  // 也匹配 "1. Yes", "2. Yes, and don't ask again" 等纯数字选项
  if (trimmed.match(/^\d+\.\s*(Yes|No|Allow|Deny)/i)) return true
  // 匹配 "Type here to tell Claude what to do differently"
  if (trimmed.match(/^Type\s+here\s+to\s+tell/i)) return true
  // 匹配 "Do you want to proceed?"
  if (trimmed.match(/^Do you want to proceed\?$/i)) return true
  // 匹配路径行（权限选项的续行，如 "      /Users/xxx/xxx"）
  if (trimmed.match(/^\/[\w/.-]+$/)) return true
  // 匹配缩进的权限选项续行（如 "      /Users/xxx/xxx" 或 "   3. Type here..."）
  if (trimmed.match(/^\s{2,}(\/|Type\s+here|\d+\.)/)) return true
  return false
}

/**
 * 解析消息内容，分离文本、代码块和思考块
 */
function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过权限选项行（由 PermissionRequestDialog 处理）
    if (isPermissionOptionLine(trimmed)) {
      i++
      continue
    }

    // 检测思考块 <thinking> 或 rita-thinking
    const thinkingMatch = trimmed.match(/^<(thinking|rita-thinking)>$/i)
    if (thinkingMatch) {
      let thinkingContent: string[] = []
      i++
      while (i < lines.length) {
        const innerLine = lines[i]
        if (innerLine.trim().match(/^<\/(thinking|rita-thinking)>$/i)) {
          i++
          break
        }
        thinkingContent.push(innerLine)
        i++
      }
      segments.push({
        type: 'thinking',
        content: thinkingContent.join('\n').trim()
      })
      continue
    }

    // 检测代码块开始
    const codeStartMatch = trimmed.match(/^```(\w*)/)
    if (codeStartMatch) {
      const language = codeStartMatch[1] || 'text'
      let codeLines: string[] = []
      i++
      while (i < lines.length) {
        if (lines[i].trim() === '```') {
          i++
          break
        }
        codeLines.push(lines[i])
        i++
      }
      segments.push({
        type: 'code',
        content: codeLines.join('\n'),
        language
      })
      continue
    }

    // 检测标题
    let headerFound = false
    for (let h = 6; h >= 1; h--) {
      if (trimmed.startsWith('#'.repeat(h) + ' ')) {
        segments.push({
          type: 'header',
          level: h as 1 | 2 | 3 | 4 | 5 | 6,
          content: trimmed.slice(h + 1),
          spans: parseSpans(trimmed.slice(h + 1))
        })
        i++
        headerFound = true
        break
      }
    }
    if (headerFound) continue

    // 检测有序列表（跳过权限相关的选项）
    const orderedListMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (orderedListMatch && !isPermissionOptionLine(trimmed)) {
      const items: ListItem[] = []
      while (i < lines.length) {
        const currentTrimmed = lines[i].trim()
        if (isPermissionOptionLine(currentTrimmed)) {
          i++
          continue
        }
        const itemMatch = currentTrimmed.match(/^(\d+)\.\s+(.+)$/)
        if (!itemMatch) break
        items.push({ number: parseInt(itemMatch[1]), text: itemMatch[2] })
        i++
      }
      if (items.length > 0) {
        segments.push({ type: 'numberedList', items })
      }
      continue
    }

    // 检测无序列表
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length) {
        const itemLine = lines[i].trim()
        if (!itemLine.startsWith('- ') && !itemLine.startsWith('* ')) break
        items.push(itemLine.slice(2))
        i++
      }
      segments.push({ type: 'list', items })
      continue
    }

    // 普通文本
    if (trimmed.length > 0 || line.length > 0) {
      // Collect consecutive text lines
      let textLines: string[] = []
      while (i < lines.length) {
        const currentLine = lines[i]
        const currentTrimmed = currentLine.trim()

        // Skip permission option lines
        if (isPermissionOptionLine(currentTrimmed)) {
          i++
          continue
        }

        // Check if this is a special block start
        if (
          currentTrimmed.match(/^```/) ||
          currentTrimmed.match(/^<(thinking|rita-thinking)>$/i) ||
          currentTrimmed.match(/^#{1,6}\s/) ||
          (currentTrimmed.match(/^\d+\.\s/) && !isPermissionOptionLine(currentTrimmed)) ||
          currentTrimmed.startsWith('- ') ||
          currentTrimmed.startsWith('* ')
        ) {
          break
        }

        textLines.push(currentLine)
        i++
      }

      const textContent = textLines.join('\n').trim()
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent,
          spans: parseSpans(textContent)
        })
      }
    } else {
      i++
    }
  }

  // 如果没有任何内容，返回原始内容作为文本
  if (segments.length === 0 && content.trim()) {
    segments.push({
      type: 'text',
      content: content.trim(),
      spans: parseSpans(content.trim())
    })
  }

  return segments
}

const MessageContent = memo(function MessageContent({ content }: MessageContentProps) {
  const segments = useMemo(() => parseContent(content), [content])

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'code':
            return (
              <CodeBlock
                key={`code-${index}`}
                code={segment.content || ''}
                language={segment.language || undefined}
              />
            )

          case 'thinking':
            return (
              <ThinkingBlock
                key={`thinking-${index}`}
                content={segment.content || ''}
              />
            )

          case 'list':
            return (
              <ListBlock
                key={`list-${index}`}
                items={segment.items as string[]}
              />
            )

          case 'numberedList':
            return (
              <ListBlock
                key={`numbered-${index}`}
                items={segment.items as { number: number; text: string }[]}
                ordered
              />
            )

          case 'header':
            return (
              <HeaderBlock
                key={`header-${index}`}
                level={segment.level!}
                spans={segment.spans!}
              />
            )

          case 'text':
          default:
            return (
              <p
                key={`text-${index}`}
                className="text-primary whitespace-pre-wrap break-words leading-relaxed"
              >
                {segment.spans ? (
                  <RenderSpans spans={segment.spans} />
                ) : (
                  segment.content
                )}
              </p>
            )
        }
      })}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return prevProps.content === nextProps.content
})

export default MessageContent
