import { ANALYTICS_TIME_ZONE } from './config'
import { CLICK_NAMES } from './events'

// Display helpers shared by the dashboard's server and client components.

const STATIC_PAGES: Record<string, string> = {
  '/': 'Home',
  '/papers': 'Papers & Briefs',
  '/projects': 'Projects',
  '/cv': 'CV',
  '/contact': 'Contact',
}

export function pageName(path: string, title?: string | null) {
  if (STATIC_PAGES[path]) return STATIC_PAGES[path]
  if (title) return title
  const paper = path.match(/^\/papers\/(.+)$/)
  if (paper) return `Paper: ${paper[1]}`
  const project = path.match(/^\/projects\/(.+)$/)
  if (project) return `Project: ${project[1]}`
  return path
}

export function formatNumber(value: number) {
  if (value >= 10_000) return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatPercent(part: number, whole: number) {
  if (!whole) return '—'
  const pct = (part / whole) * 100
  return `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`
}

export function formatDuration(ms: number | null) {
  if (ms === null) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: ANALYTICS_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString('en-GB', {
    timeZone: ANALYTICS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatGap(ms: number) {
  if (ms < 1000) return '<1s'
  return `+${formatDuration(ms)}`
}

let regionNames: Intl.DisplayNames | null = null
export function countryName(code: string | null) {
  if (!code) return 'Unknown'
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

export const CHANNEL_LABELS: Record<string, string> = {
  direct: 'Direct',
  search: 'Search',
  social: 'Social',
  email: 'Email',
  referral: 'Referral',
  unknown: 'Unknown',
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  pageview: 'Page view',
  click: 'Click',
  scroll: 'Scroll depth',
  engagement: 'Time on page',
}

export function eventName(name: string) {
  return (CLICK_NAMES as Record<string, string>)[name] ?? EVENT_TYPE_LABELS[name] ?? name
}

// One line for the activity feed: "Viewed Home", "Downloaded the CV", …
export function describeEvent(event: { type: string; name: string; label: string | null; path: string; target: string | null }) {
  if (event.type === 'pageview') return `Viewed ${pageName(event.path)}`
  if (event.type === 'scroll') return `Scrolled on ${pageName(event.path)}`
  if (event.type === 'engagement') return `Spent time on ${pageName(event.path)}`
  switch (event.name) {
    case 'cv_download':
      return 'Downloaded the CV'
    case 'outbound':
      return `Followed an external link: ${event.label ?? event.target ?? ''}`.trim()
    case 'whatsapp':
      return 'Opened WhatsApp'
    case 'contact_copy':
      return event.label ?? 'Copied contact details'
    case 'contact_email':
      return 'Clicked the email link'
    default:
      return `Clicked “${event.label ?? eventName(event.name)}”`
  }
}

export function shortSession(id: string) {
  return id.slice(0, 8)
}
