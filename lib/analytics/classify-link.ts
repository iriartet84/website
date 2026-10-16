import { CLICK_NAMES, type ClickName } from './events'

// Turns a clicked link into a stable event name, a readable label and a
// destination — from the URL, not from CSS selectors. Used in the browser
// by the tracker; pure, so it is unit-tested (tests/analytics).

export type ClickInfo = { name: ClickName; label: string; target: string | null }

const LABEL_MAX = 120

export function cleanLabel(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LABEL_MAX)
}

// Destination as stored: external links keep origin + path only (query
// strings and fragments can carry tokens or personal data); internal links
// keep the path plus the one query parameter the site uses (?category=).
export function normalizeTarget(href: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }
  if (url.protocol === 'mailto:') return 'mailto:'
  if (url.protocol === 'tel:') return 'tel:'
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.origin === origin) {
    const category = url.searchParams.get('category')
    return (url.pathname + (category ? `?category=${encodeURIComponent(category)}` : '')).slice(0, 300)
  }
  return (url.origin + url.pathname).replace(/\/$/, '').slice(0, 300)
}

function hostOf(href: string, origin: string) {
  try {
    return new URL(href, origin).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const KNOWN_SITES: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)github\.com$|\.github\.io$/, 'GitHub'],
  [/^wa\.me$|(^|\.)whatsapp\.com$/, 'WhatsApp'],
  [/(^|\.)ssrn\.com$/, 'SSRN'],
  [/(^|\.)researchgate\.net$/, 'ResearchGate'],
  [/(^|\.)scholar\.google\./, 'Google Scholar'],
  [/(^|\.)arxiv\.org$/, 'arXiv'],
  [/(^|\.)doi\.org$/, 'DOI'],
]

export function classifyLink(input: {
  href: string
  origin: string
  // Current page path, e.g. "/cv".
  pagePath: string
  // Visible or accessible text of the element.
  text?: string | null
  // Explicit overrides from data-track / data-track-label.
  trackName?: string | null
  trackLabel?: string | null
}): ClickInfo | null {
  const target = normalizeTarget(input.href, input.origin)
  if (!target) return null
  const text = cleanLabel(input.trackLabel || input.text)
  const explicit =
    input.trackName && input.trackName in CLICK_NAMES ? (input.trackName as ClickName) : null

  const withLabel = (name: ClickName, fallback: string): ClickInfo => ({
    name: explicit ?? name,
    label: cleanLabel(input.trackLabel) || text || fallback,
    target,
  })

  if (target === 'mailto:') return withLabel('contact_email', 'Email link')
  if (target === 'tel:') return withLabel('contact_phone', 'Phone link')

  const host = hostOf(input.href, input.origin)
  let internal = false
  try {
    internal = new URL(input.href, input.origin).origin === input.origin
  } catch {
    internal = false
  }

  if (!internal) {
    const known = KNOWN_SITES.find(([pattern]) => pattern.test(host))?.[1]
    if (known === 'WhatsApp') return withLabel('whatsapp', 'Open WhatsApp')
    // Known profiles get a fixed label ("Visit LinkedIn") so the same
    // destination ranks as one row whatever the link text says.
    if (known && !input.trackLabel) return { name: explicit ?? 'outbound', label: `Visit ${known}`, target }
    return withLabel('outbound', `Visit ${host}`)
  }

  const path = target.split('?')[0]
  if (path.startsWith('/api/files/')) {
    const isCv = input.pagePath === '/cv' || /\bcv\b|résumé|resume/i.test(text)
    return withLabel(isCv ? 'cv_download' : 'file_download', isCv ? 'Download CV' : 'Download file')
  }
  if (/^\/papers\/[^/]+$/.test(path)) return withLabel('paper_open', `Open paper ${path.slice(8)}`)
  if (/^\/projects\/[^/]+$/.test(path)) return withLabel('project_open', `Open project ${path.slice(10)}`)
  if (path === '/papers' && target.includes('?category=')) {
    return withLabel('research_theme_open', 'Open research theme')
  }
  return withLabel('nav', `Go to ${path}`)
}
