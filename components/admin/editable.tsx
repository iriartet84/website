'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// In-place editing primitives. The public components render these in place
// of their plain text when they're given an `edit` prop (see e.g.
// components/hero.tsx), passing their own classNames through — so an
// editable heading is the real heading, in the real layout, with a dashed
// outline marking it as editable. No separate admin styling to keep in sync.

// Shared affordance: a faint dashed outline so every editable element is
// visible at a glance, stronger on hover, solid while editing.
export const editableOutline =
  'rounded-[3px] outline-1 outline-dashed outline-offset-[3px] outline-steel/30 transition-[outline-color] hover:outline-steel/70 focus:outline-2 focus:outline-solid focus:outline-steel focus-within:outline-2 focus-within:outline-solid focus-within:outline-steel'

type TextTag = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div'

// textContent, not innerText: innerText applies CSS text-transform, so an
// eyebrow styled `uppercase` would be saved in capitals. Line breaks aren't
// allowed (the public pages render every field as a single paragraph), so
// any that sneak in become spaces.
function readText(el: HTMLElement) {
  return (el.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s*\n+\s*/g, ' ')
}

export function EditableText({
  value,
  onChange,
  label,
  as: Tag = 'span',
  className,
  multiline = false,
  placeholder,
  autoFocus = false,
  onEnter,
  onBlur,
  onBackspaceEmpty,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  as?: TextTag
  className?: string
  multiline?: boolean
  placeholder?: string
  autoFocus?: boolean
  // Called on Enter (which never inserts a line break); default: finish
  // editing (blur).
  onEnter?: () => void
  onBlur?: (value: string) => void
  onBackspaceEmpty?: () => void
}) {
  const ref = useRef<HTMLElement | null>(null)
  // contentEditable owns its DOM while you type, so React only ever renders
  // the first value. Later changes that didn't come from typing here (Discard,
  // reordering, a deleted neighbour) are written into the DOM directly below.
  const [initial] = useState(value)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && readText(el) !== value) {
      el.textContent = value
    }
  }, [value])

  useLayoutEffect(() => {
    const el = ref.current
    if (!autoFocus || !el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    // Only on mount: autoFocus is for items that were just added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (onEnter) onEnter()
      else event.currentTarget.blur()
    }
    if (event.key === 'Escape') event.currentTarget.blur()
    if (event.key === 'Backspace' && onBackspaceEmpty && readText(event.currentTarget) === '') {
      event.preventDefault()
      onBackspaceEmpty()
    }
  }

  // Paste as plain text only — keeps formatting from other pages out, and
  // newlines out of single-line fields.
  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain').replace(/\s*\n+\s*/g, ' ')
    document.execCommand('insertText', false, text)
  }

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node
      }}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline={multiline || undefined}
      data-placeholder={placeholder ?? label}
      spellCheck
      className={cn(className, 'editable-text cursor-text', editableOutline)}
      onInput={(event) => onChange(readText(event.currentTarget))}
      onBlur={(event) => onBlur?.(readText(event.currentTarget).trim())}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    >
      {initial}
    </Tag>
  )
}

// A chip/badge whose value is picked from a list: the public chip stays as
// it is, with an invisible native <select> laid over it — clicking the chip
// opens the picker.
export function EditableSelect({
  value,
  options,
  onChange,
  label,
  children,
  className,
}: {
  value: string
  options: readonly string[] | { value: string; label: string }[]
  onChange: (value: string) => void
  label: string
  children: ReactNode
  className?: string
}) {
  const normalised = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )
  if (!normalised.some((option) => option.value === value)) {
    normalised.unshift({ value, label: value })
  }
  return (
    <span className={cn('relative inline-flex', editableOutline, 'rounded-full', className)}>
      {children}
      <select
        aria-label={label}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {normalised.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}

// A row of tag chips: each chip's text is editable in place, × removes it,
// and a dashed "+" chip adds one. Empty chips disappear when you leave them.
export function EditableTags({
  tags,
  onChange,
  chipClassName,
  label = 'tag',
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  chipClassName: string
  label?: string
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  function update(index: number, value: string) {
    onChange(tags.map((tag, i) => (i === index ? value : tag)))
  }
  function remove(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }
  function add() {
    setFocusIndex(tags.length)
    onChange([...tags, ''])
  }

  return (
    <>
      {tags.map((tag, index) => (
        <span key={`${index}-${tags.length}`} className="group/tag relative inline-flex">
          <EditableText
            value={tag}
            label={`Edit ${label}`}
            placeholder={label}
            className={chipClassName}
            autoFocus={focusIndex === index}
            onChange={(value) => update(index, value)}
            onBlur={(value) => {
              if (focusIndex === index) setFocusIndex(null)
              if (!value) remove(index)
            }}
            onEnter={add}
          />
          <button
            type="button"
            aria-label={`Remove ${label} “${tag}”`}
            title={`Remove ${label}`}
            onClick={() => remove(index)}
            className="absolute -right-1.5 -top-1.5 z-10 hidden size-4 items-center justify-center rounded-full bg-navy text-white shadow-sm group-hover/tag:flex focus-visible:flex"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={add}
        title={`Add ${label}`}
        aria-label={`Add ${label}`}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-steel/40 px-2.5 py-1 text-xs font-medium text-steel-700 transition-colors hover:border-steel hover:bg-steel/10"
      >
        <Plus className="size-3" />
        {label}
      </button>
    </>
  )
}

// A bullet list in the public CV markup. Enter starts a new bullet,
// Backspace on an empty one removes it.
export function EditableBullets({
  items,
  onChange,
  itemClassName,
  dotClassName,
  listClassName,
}: {
  items: string[]
  onChange: (items: string[]) => void
  itemClassName: string
  dotClassName: string
  listClassName: string
}) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  function insertAfter(index: number) {
    const next = [...items]
    next.splice(index + 1, 0, '')
    setFocusIndex(index + 1)
    onChange(next)
  }
  function remove(index: number) {
    setFocusIndex(index > 0 ? index - 1 : null)
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <ul className={listClassName}>
      {items.map((item, index) => (
        <li key={`${index}-${items.length}`} className={cn(itemClassName, 'group/bullet relative')}>
          <span className={dotClassName} />
          <EditableText
            value={item}
            label="Bullet point"
            placeholder="New bullet point"
            className="min-w-0 flex-1"
            autoFocus={focusIndex === index}
            onChange={(value) => onChange(items.map((it, i) => (i === index ? value : it)))}
            onEnter={() => insertAfter(index)}
            onBackspaceEmpty={() => remove(index)}
            onBlur={(value) => {
              if (focusIndex === index) setFocusIndex(null)
              if (!value && items.length > 1) remove(index)
            }}
          />
          <button
            type="button"
            aria-label="Remove bullet point"
            title="Remove bullet point"
            onClick={() => remove(index)}
            className="absolute -left-6 top-0.5 hidden size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover/bullet:flex"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => insertAfter(items.length - 1)}
          className="inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:text-navy"
        >
          <Plus className="size-3" />
          Add bullet point
        </button>
      </li>
    </ul>
  )
}
