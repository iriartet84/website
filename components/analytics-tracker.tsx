'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { classifyLink, cleanLabel } from '@/lib/analytics/classify-link'
import { CLICK_NAMES, MAX_EVENTS_PER_REQUEST, SCROLL_MILESTONES } from '@/lib/analytics/events'

// First-party, cookieless analytics for the public site. Sends page views,
// clicks on links and buttons, scroll-depth milestones and time on page to
// /api/analytics, which validates everything (lib/analytics/validate.ts).
// Stores nothing in the browser (no cookies, no local/session storage),
// never reads form fields, and does nothing when Do Not Track or Global
// Privacy Control is on. Elements can name their own event with
// data-track="<click name>" and data-track-label="Readable label";
// data-no-track opts an element (and its children) out.

type QueuedEvent = {
  t: 'pageview' | 'click' | 'scroll' | 'engagement'
  n: string
  p: string
  l?: string
  g?: string
  v?: number
  r?: string
  u?: string
  at: number
}

const ENDPOINT = '/api/analytics'

function privacySignal() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.msDoNotTrack === '1'
}

function deviceCategory(): 'desktop' | 'mobile' | 'tablet' {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (!coarse) return 'desktop'
  return Math.min(window.screen.width, window.screen.height) < 600 ? 'mobile' : 'tablet'
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  const state = useRef({
    enabled: false,
    queue: [] as QueuedEvent[],
    timer: 0 as number | undefined,
    firstView: true,
    path: '',
    visibleSince: 0,
    engagedMs: 0,
    milestones: new Set<number>(),
    device: 'desktop' as 'desktop' | 'mobile' | 'tablet',
  })

  // Sends the queue. `beacon` is for page hide/unload, where fetch may be
  // cancelled.
  const flush = useRef((beacon = false) => {
    const s = state.current
    window.clearTimeout(s.timer)
    s.timer = undefined
    while (s.queue.length) {
      const batch = s.queue.splice(0, MAX_EVENTS_PER_REQUEST)
      const now = Date.now()
      const body = JSON.stringify({
        d: s.device,
        e: batch.map(({ at, ...event }) => ({ ...event, a: Math.min(120_000, Math.max(0, now - at)) })),
      })
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      } else {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
          credentials: 'same-origin',
        }).catch(() => {})
      }
    }
  })

  const push = useRef((event: Omit<QueuedEvent, 'at'>, immediate = false) => {
    const s = state.current
    if (!s.enabled) return
    s.queue.push({ ...event, at: Date.now() })
    if (immediate || s.queue.length >= 10) flush.current()
    else if (s.timer === undefined) s.timer = window.setTimeout(() => flush.current(), 4000)
  })

  // Time on the current page, counted only while the tab is visible.
  const closeEngagement = useRef(() => {
    const s = state.current
    if (!s.path) return
    if (s.visibleSince) {
      s.engagedMs += Date.now() - s.visibleSince
      s.visibleSince = document.visibilityState === 'visible' ? Date.now() : 0
    }
    if (s.engagedMs >= 500) {
      push.current({ t: 'engagement', n: 'page_engagement', p: s.path, v: Math.min(s.engagedMs, 30 * 60 * 1000) })
    }
    s.engagedMs = 0
  })

  // Listeners, once.
  useEffect(() => {
    const s = state.current
    s.enabled = !privacySignal()
    if (!s.enabled) return
    s.device = deviceCategory()

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const element = target?.closest<HTMLElement>('a[href], button, [data-track]')
      if (!element || element.closest('[data-no-track]') || !s.path) return
      if (element.closest('input, textarea, select, [contenteditable="true"]')) return
      const trackName = element.dataset.track ?? null
      const trackLabel = element.dataset.trackLabel ?? null
      const text = element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText

      if (element instanceof HTMLAnchorElement) {
        const info = classifyLink({
          href: element.getAttribute('href') ?? '',
          origin: window.location.origin,
          pagePath: s.path,
          text,
          trackName,
          trackLabel,
        })
        if (info) push.current({ t: 'click', n: info.name, p: s.path, l: info.label, g: info.target ?? undefined })
        return
      }
      const name = trackName && trackName in CLICK_NAMES ? trackName : 'button'
      const label = cleanLabel(trackLabel || text)
      if (!label) return
      push.current({ t: 'click', n: name, p: s.path, l: label })
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const doc = document.documentElement
        // Pages that barely scroll would report "read 90%" on load.
        if (doc.scrollHeight < window.innerHeight * 1.2 || !s.path) return
        const depth = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100
        for (const milestone of SCROLL_MILESTONES) {
          if (depth >= milestone && !s.milestones.has(milestone)) {
            s.milestones.add(milestone)
            push.current({ t: 'scroll', n: 'scroll_depth', p: s.path, v: milestone })
          }
        }
      })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        closeEngagement.current()
        s.visibleSince = 0
        flush.current(true)
      } else if (!s.visibleSince) {
        s.visibleSince = Date.now()
      }
    }
    const onPageHide = () => {
      closeEngagement.current()
      flush.current(true)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  // A page view per route change (client-side navigations included).
  useEffect(() => {
    const s = state.current
    if (!s.enabled || !pathname || pathname === s.path) return
    closeEngagement.current()
    s.path = pathname
    s.milestones = new Set()
    s.engagedMs = 0
    s.visibleSince = document.visibilityState === 'visible' ? Date.now() : 0

    const event: Omit<QueuedEvent, 'at'> = { t: 'pageview', n: 'pageview', p: pathname }
    if (s.firstView) {
      s.firstView = false
      if (document.referrer) event.r = document.referrer.slice(0, 500)
      const utm = new URLSearchParams(window.location.search).get('utm_source')
      if (utm) event.u = utm.slice(0, 80)
    }
    push.current(event, true)
  }, [pathname])

  return null
}
