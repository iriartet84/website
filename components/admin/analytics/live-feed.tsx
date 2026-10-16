'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { countryName, describeEvent, formatDateTime } from '@/lib/analytics/format'
import { cn } from '@/lib/utils'

// Recent page views and clicks, refreshed every 20 seconds while the tab is
// visible (plain polling: no extra infrastructure).

type FeedEvent = {
  id: number
  createdAt: string
  type: string
  name: string
  label: string | null
  path: string
  target: string | null
  country: string | null
  sessionId: string
}

const POLL_MS = 20_000
const KEEP = 40

export function LiveFeed({ initial }: { initial: FeedEvent[] }) {
  const [events, setEvents] = useState(initial)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [status, setStatus] = useState<'live' | 'paused' | 'error'>('live')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const latest = useRef(initial[0]?.id ?? 0)

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/analytics/feed?after=${latest.current}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      const data = (await response.json()) as { events: FeedEvent[] }
      if (data.events.length) {
        latest.current = data.events[0].id
        setFresh(new Set(data.events.map((e) => e.id)))
        setEvents((current) => [...data.events, ...current].slice(0, KEEP))
      }
      setUpdatedAt(new Date())
      setStatus('live')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const schedule = () => {
      window.clearInterval(timer)
      if (document.visibilityState === 'visible') {
        setStatus((s) => (s === 'paused' ? 'live' : s))
        timer = window.setInterval(poll, POLL_MS)
      } else {
        setStatus('paused')
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') poll()
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [poll])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            status === 'live' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-300',
          )}
        />
        <span role="status">
          {status === 'live'
            ? `Live — checks every ${POLL_MS / 1000}s${updatedAt ? `, last at ${updatedAt.toLocaleTimeString('en-GB')}` : ''}`
            : status === 'paused'
              ? 'Paused while this tab is hidden'
              : 'Could not refresh — retrying'}
        </span>
        <button type="button" onClick={poll} className="ml-auto font-medium text-steel-700 hover:text-navy">
          Refresh now
        </button>
      </div>
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No page views or clicks in the last 7 days. New activity will appear here.
        </p>
      ) : (
        <ol className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {events.map((event) => (
            <li
              key={event.id}
              className={cn(
                'flex gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors duration-1000',
                fresh.has(event.id) ? 'bg-steel/10' : 'bg-transparent',
              )}
            >
              <time className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={event.createdAt}>
                {formatDateTime(event.createdAt)}
              </time>
              <span className="min-w-0 flex-1">
                <span className="text-navy">{describeEvent(event)}</span>
                {event.type === 'click' && (
                  <span className="text-muted-foreground"> on {event.path}</span>
                )}
                {event.target && event.type === 'click' && !event.target.startsWith('/') && (
                  <span className="block truncate text-xs text-muted-foreground">→ {event.target}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {event.country ? countryName(event.country) : ''}
                <span className="ml-2 font-mono text-[10px]" title="Pseudonymous session">
                  {event.sessionId}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
