'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Older browsers / non-secure contexts: copy through a hidden textarea.
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('Copy failed')
}

// A button that copies `value` to the clipboard (used for the email address
// and phone number instead of mailto:/tel: links). A small "Copied" bubble
// appears above it for a moment, and screen readers hear the same through a
// polite live region. `copiedChildren`, when given, replaces `children`
// while the copied state lasts (e.g. a check mark in place of the icon).
// Both are plain nodes, so server components can render this too.
export function CopyButton({
  value,
  label,
  className,
  wrapperClassName,
  showBubble = true,
  tabIndex,
  children,
  copiedChildren,
}: {
  value: string
  // What is being copied, e.g. "email address" — used in the accessible
  // name ("Copy email address: …") and the confirmation.
  label: string
  className?: string
  // The positioning wrapper around the button (and the bubble) — e.g.
  // "w-full" so a card-style button fills its grid cell.
  wrapperClassName?: string
  // Off where the button sits inside a clipped (overflow-hidden) container;
  // the caller then shows the copied state itself via `children`.
  showBubble?: boolean
  tabIndex?: number
  children: ReactNode
  copiedChildren?: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    window.clearTimeout(timer.current)
    try {
      await writeClipboard(value)
      setFailed(false)
      setCopied(true)
    } catch {
      setCopied(false)
      setFailed(true)
    }
    timer.current = window.setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, 1800)
  }

  const message = copied ? 'Copied' : failed ? 'Copy failed' : ''

  return (
    <span className={cn('relative inline-flex w-fit max-w-full', wrapperClassName)}>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}: ${value}`}
        title={`Copy ${label}`}
        tabIndex={tabIndex}
        className={cn('cursor-copy', className)}
      >
        {copied && copiedChildren !== undefined ? copiedChildren : children}
      </button>
      {showBubble && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 font-sans text-[11px] font-medium leading-none text-white shadow-sm transition-all duration-200',
            message ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
          )}
        >
          {message || 'Copied'}
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copied to clipboard` : failed ? `Couldn't copy the ${label}` : ''}
      </span>
    </span>
  )
}
