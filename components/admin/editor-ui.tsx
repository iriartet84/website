'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { setUnsavedChanges } from '@/components/admin/unsaved-guard'

// Chrome the page editors put *around* the public components: per-item
// toolbars, the settings popover, placeholders for removed items, and the
// sticky save bar. Kept visually distinct (small, white, shadowed) from the
// page itself so it reads as tooling rather than content.

const toolButton =
  'inline-flex size-7 items-center justify-center rounded-full text-navy transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-30'

export function ItemToolbar({
  onMoveBack,
  onMoveForward,
  canMoveBack,
  canMoveForward,
  direction = 'vertical',
  published,
  onTogglePublished,
  onRemove,
  settings,
  className,
  itemLabel,
}: {
  onMoveBack: () => void
  onMoveForward: () => void
  canMoveBack: boolean
  canMoveForward: boolean
  direction?: 'vertical' | 'horizontal'
  published?: boolean
  onTogglePublished?: () => void
  onRemove: () => void
  settings?: ReactNode
  className?: string
  itemLabel: string
}) {
  const Back = direction === 'vertical' ? ArrowUp : ArrowLeft
  const Forward = direction === 'vertical' ? ArrowDown : ArrowRight
  return (
    <div
      className={cn(
        'z-20 inline-flex items-center gap-0.5 rounded-full border border-border bg-white/95 p-0.5 font-sans shadow-md shadow-navy/10 backdrop-blur',
        className,
      )}
    >
      <button type="button" className={toolButton} onClick={onMoveBack} disabled={!canMoveBack} title={`Move ${itemLabel} ${direction === 'vertical' ? 'up' : 'earlier'}`} aria-label={`Move ${itemLabel} ${direction === 'vertical' ? 'up' : 'earlier'}`}>
        <Back className="size-3.5" />
      </button>
      <button type="button" className={toolButton} onClick={onMoveForward} disabled={!canMoveForward} title={`Move ${itemLabel} ${direction === 'vertical' ? 'down' : 'later'}`} aria-label={`Move ${itemLabel} ${direction === 'vertical' ? 'down' : 'later'}`}>
        <Forward className="size-3.5" />
      </button>
      {onTogglePublished && (
        <button
          type="button"
          className={toolButton}
          onClick={onTogglePublished}
          title={published ? `Hide ${itemLabel} from the public site` : `Publish ${itemLabel}`}
          aria-label={published ? `Hide ${itemLabel} from the public site` : `Publish ${itemLabel}`}
          aria-pressed={!published}
        >
          {published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-amber-600" />}
        </button>
      )}
      {settings}
      <button
        type="button"
        className={cn(toolButton, 'hover:bg-destructive/10 hover:text-destructive')}
        onClick={onRemove}
        title={`Delete ${itemLabel}`}
        aria-label={`Delete ${itemLabel}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// Popover used for the settings that have no visible place on the public
// page (slug, full date, link targets…).
export function SettingsPopover({
  title,
  children,
  triggerLabel,
  trigger,
}: {
  title: string
  children: ReactNode
  triggerLabel: string
  trigger?: ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={trigger ? 'inline-flex' : toolButton}
        title={triggerLabel}
        aria-label={triggerLabel}
      >
        {trigger ?? <Settings2 className="size-3.5" />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className="z-50">
          <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] origin-[var(--transform-origin)] rounded-2xl border border-border bg-white p-4 font-sans text-sm text-foreground shadow-xl shadow-navy/15 outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-steel-700">
              {title}
            </Popover.Title>
            <div className="space-y-3">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const settingsInput =
  'w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-navy outline-none focus:border-steel focus:ring-2 focus:ring-steel/20'

// Wraps one editable item (a paper, a card, a CV entry). Unpublished items
// stay in place but faded with a "Hidden" badge; an item named in a save
// error gets a red ring.
export function EditableItem({
  id,
  children,
  published = true,
  highlighted = false,
  toolbar,
  toolbarClassName = '-top-4 right-0',
  className,
  isNew = false,
}: {
  id?: string
  children: ReactNode
  published?: boolean
  highlighted?: boolean
  toolbar: ReactNode
  toolbarClassName?: string
  className?: string
  isNew?: boolean
}) {
  return (
    <div
      id={id}
      className={cn(
        'group/item relative scroll-mt-28 rounded-2xl transition-shadow',
        highlighted && 'ring-2 ring-destructive ring-offset-8 ring-offset-transparent',
        className,
      )}
    >
      <div className={cn('pointer-events-none absolute z-20 flex gap-1.5', toolbarClassName)}>
        {!published && (
          <span className="pointer-events-auto self-center rounded-full bg-amber-100 px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Hidden
          </span>
        )}
        {isNew && (
          <span className="pointer-events-auto self-center rounded-full bg-steel/15 px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-steel-700">
            New
          </span>
        )}
        <div className="pointer-events-auto opacity-70 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100">
          {toolbar}
        </div>
      </div>
      <div className={cn('h-full', !published && 'opacity-50')}>{children}</div>
    </div>
  )
}

export function RemovedItem({
  label,
  onUndo,
  className,
}: {
  label: string
  onUndo: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-5 py-4 font-sans text-sm text-muted-foreground',
        className,
      )}
    >
      <span>
        <span className="font-medium text-navy">{label}</span> will be deleted when you save.
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm hover:bg-secondary"
      >
        <RotateCcw className="size-3.5" />
        Undo
      </button>
    </div>
  )
}

export function AddItemButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-steel/30 px-5 py-6 font-sans text-sm font-medium text-steel-700 transition-colors hover:border-steel hover:bg-steel/5',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---- Save bar ----------------------------------------------------------------

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving'; message: string }
  | { kind: 'saved' }
  | { kind: 'error'; message: string; clientKey?: string }

export function SaveBar({
  dirty,
  status,
  onSave,
  onDiscard,
  onShowError,
}: {
  dirty: boolean
  status: SaveStatus
  onSave: () => void
  onDiscard: () => void
  onShowError?: () => void
}) {
  const saving = status.kind === 'saving'

  // Warn before closing/reloading the tab with unsaved edits, and let the
  // admin navigation (components/admin/admin-bar.tsx) ask the same.
  useEffect(() => {
    setUnsavedChanges(dirty)
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  useEffect(() => () => setUnsavedChanges(false), [])

  // ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (dirty && !saving) onSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, saving, onSave])

  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    if (status.kind !== 'saved') return
    setShowSaved(true)
    const timer = window.setTimeout(() => setShowSaved(false), 3500)
    return () => window.clearTimeout(timer)
  }, [status])

  const visible = dirty || saving || status.kind === 'error' || showSaved

  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 font-sans transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      <div className="pointer-events-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-sm text-white shadow-2xl shadow-navy/30">
        {status.kind === 'error' ? (
          <span className="flex min-w-0 items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
            <span className="min-w-0">
              {status.message}
              {status.clientKey && onShowError && (
                <button type="button" onClick={onShowError} className="ml-2 font-semibold underline underline-offset-2">
                  Show
                </button>
              )}
            </span>
          </span>
        ) : saving ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            {status.message}
          </span>
        ) : dirty ? (
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-400" />
            Unsaved changes — preview only until you save
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Check className="size-4 text-emerald-300" />
            All changes saved and live
          </span>
        )}
        {(dirty || status.kind === 'error') && (
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="rounded-full px-3 py-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="rounded-full bg-white px-4 py-1.5 font-semibold text-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

// Scrolls an item into view and returns its id, for the "Show" link on a
// save error.
export function scrollToItem(domId: string) {
  const el = document.getElementById(domId)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
