'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SaveStatus } from '@/components/admin/editor-ui'

// Shared state handling for the page editors: the editor works on a local
// copy of the page (that's the live preview), knows whether it differs
// from what's saved, and re-syncs from the server after a save.

// Snapshot used for "unsaved changes" detection. Files picked for upload
// count as changes (compared by name/size/date — File objects themselves
// can't be serialised).
function snapshot(value: unknown) {
  return JSON.stringify(value, (_key, v) =>
    typeof File !== 'undefined' && v instanceof File ? `file:${v.name}:${v.size}:${v.lastModified}` : v,
  )
}

export function useEditorState<Data, State>(initialData: Data, build: (data: Data) => State) {
  const router = useRouter()
  const [state, setState] = useState<State>(() => build(initialData))
  const [baseline, setBaseline] = useState(() => snapshot(build(initialData)))
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' })

  // New server data (after a save + router.refresh()) replaces the local
  // copy, so ids of newly created items etc. come from the database.
  useEffect(() => {
    const next = build(initialData)
    setState(next)
    setBaseline(snapshot(next))
    // `build` is a module-level function in every editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const dirty = useMemo(() => snapshot(state) !== baseline, [state, baseline])

  const discard = useCallback(() => {
    const next = build(initialData)
    setState(next)
    setBaseline(snapshot(next))
    setStatus({ kind: 'idle' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const markSaved = useCallback(
    (saved: State) => {
      setBaseline(snapshot(saved))
      setStatus({ kind: 'saved' })
      router.refresh()
    },
    [router],
  )

  return { state, setState, dirty, status, setStatus, discard, markSaved }
}

let counter = 0
export function newClientKey(prefix: string) {
  counter += 1
  return `new-${prefix}-${Date.now().toString(36)}-${counter}`
}

// Moves the item at `from` to `to` (both indexes into the full list).
export function moveItem<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// Focuses the first editable field inside an item (used right after
// adding one).
export function focusItem(domId: string) {
  window.requestAnimationFrame(() => {
    const el = document.getElementById(domId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const field = el?.querySelector<HTMLElement>('[contenteditable]')
    field?.focus()
  })
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
