'use client'

import { useEffect, useState } from 'react'
import { formatAbsoluteDate } from '@/lib/project-meta'

// "Updated 3 hours ago". The server (and the first client render) show the
// absolute date, so the static HTML is correct and hydration matches; the
// relative wording takes over after mount and keeps itself current.

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function relative(time: number, now: number) {
  // Clamped: a timestamp slightly in the future (clock skew) reads "just now".
  const seconds = Math.min(0, Math.round((time - now) / 1000))
  const abs = Math.abs(seconds)
  if (abs < 60) return 'just now'
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relativeFormat.format(Math.round(seconds / 86400), 'day')
  return null
}

export function Freshness({
  iso,
  prefix = 'Updated',
  className,
}: {
  iso: string
  prefix?: string
  className?: string
}) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const absolute = formatAbsoluteDate(iso)
  const time = Date.parse(iso)
  // Date-only values ("2026-09-01") have no time of day, so "3 hours ago"
  // would be invented precision: they keep the absolute date.
  const hasTime = iso.includes('T')
  const text = now !== null && hasTime && !Number.isNaN(time) ? (relative(time, now) ?? `on ${absolute}`) : `on ${absolute}`

  return (
    <time dateTime={iso} title={absolute} className={className}>
      {prefix} {text}
    </time>
  )
}
