import type { ReactNode } from 'react'

// Lightweight markdown renderer for chat messages.
// Supports:
// - **bold** / __bold__
// - *italic* / _italic_
// - `code`
// - [link](url)
// - Bullet lists (lines starting with "- " or "* ")
// - Numbered lists (lines starting with "1. " "2. " etc.)
// - Line breaks

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Matches: **bold**, __bold__, *italic*, _italic_, `code`, [link](url)
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g

  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const key = `${keyPrefix}-${i++}`
    if (match[2] !== undefined) {
      nodes.push(<strong key={key} className="font-semibold">{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key} className="font-semibold">{match[3]}</strong>)
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{match[4]}</em>)
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[5]}</em>)
    } else if (match[6] !== undefined) {
      nodes.push(
        <code key={key} className="px-1 py-0.5 bg-black/10 rounded text-[0.85em] font-mono">
          {match[6]}
        </code>
      )
    } else if (match[7] !== undefined && match[8] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          {match[7]}
        </a>
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function renderMarkdown(content: string): ReactNode {
  if (!content) return null

  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null
  let blockIndex = 0

  function flushList() {
    if (!listBuffer) return
    const items = listBuffer.items.map((item, i) => (
      <li key={`li-${blockIndex}-${i}`} className="ml-4">
        {renderInline(item, `li-${blockIndex}-${i}`)}
      </li>
    ))
    if (listBuffer.type === 'ul') {
      blocks.push(
        <ul key={`ul-${blockIndex++}`} className="list-disc pl-2 my-1 space-y-0.5">
          {items}
        </ul>
      )
    } else {
      blocks.push(
        <ol key={`ol-${blockIndex++}`} className="list-decimal pl-2 my-1 space-y-0.5">
          {items}
        </ol>
      )
    }
    listBuffer = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/)
    const numberMatch = line.match(/^\s*\d+\.\s+(.*)$/)

    if (bulletMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList()
        listBuffer = { type: 'ul', items: [] }
      }
      listBuffer.items.push(bulletMatch[1])
    } else if (numberMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList()
        listBuffer = { type: 'ol', items: [] }
      }
      listBuffer.items.push(numberMatch[1])
    } else {
      flushList()
      if (line.trim() === '') {
        blocks.push(<div key={`br-${blockIndex++}`} className="h-2" />)
      } else {
        blocks.push(
          <div key={`p-${blockIndex++}`}>
            {renderInline(line, `p-${blockIndex}`)}
          </div>
        )
      }
    }
  }

  flushList()
  return <>{blocks}</>
}
