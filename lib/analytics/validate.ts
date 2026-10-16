import { z } from 'zod'
import {
  CLICK_NAMES,
  DEVICES,
  EVENT_NAMES,
  MAX_ENGAGEMENT_MS,
  MAX_EVENTS_PER_REQUEST,
  SCROLL_MILESTONES,
  type Channel,
  type Device,
  type EventType,
} from './events'
import { cleanLabel } from './classify-link'

// Server-side checks for the public collection endpoint. Everything here is
// pure (no database, no request objects) so it is unit-tested directly.

// Public pages that may be reported. Admin, login and API paths never are.
const PUBLIC_PATH = /^\/(?:(?:papers|projects)(?:\/[a-z0-9][a-z0-9-]{0,119})?|cv|contact)?$/

export function isTrackablePath(path: string) {
  return PUBLIC_PATH.test(path)
}

const eventSchema = z
  .object({
    t: z.enum(['pageview', 'click', 'scroll', 'engagement']),
    n: z.string().max(40),
    p: z.string().max(200),
    l: z.string().max(400).optional(),
    g: z.string().max(400).optional(),
    v: z.number().int().optional(),
    // Pageviews only: the document referrer and ?utm_source on landing.
    r: z.string().max(500).optional(),
    u: z.string().max(80).optional(),
    // How long ago the event happened (ms): queued events keep their time.
    a: z.number().int().min(0).max(120_000).optional(),
  })
  .strict()

export const payloadSchema = z
  .object({
    d: z.enum(DEVICES).optional(),
    e: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_REQUEST),
  })
  .strict()

export type RawEvent = z.infer<typeof eventSchema>

export type CleanEvent = {
  type: EventType
  name: string
  label: string | null
  path: string
  target: string | null
  value: number | null
  referrer: string | null
  utmSource: string | null
  ageMs: number
}

// Returns the event in stored form, or null when it is not acceptable.
// Invalid events are dropped one by one; a request is rejected only when
// it is malformed as a whole.
export function cleanEvent(raw: RawEvent): CleanEvent | null {
  const names = EVENT_NAMES[raw.t] as readonly string[]
  if (!names.includes(raw.n)) return null
  if (!isTrackablePath(raw.p)) return null

  let value: number | null = null
  if (raw.t === 'scroll') {
    if (!SCROLL_MILESTONES.includes(raw.v as (typeof SCROLL_MILESTONES)[number])) return null
    value = raw.v!
  } else if (raw.t === 'engagement') {
    if (raw.v === undefined || raw.v < 0 || raw.v > MAX_ENGAGEMENT_MS) return null
    value = raw.v
  } else if (raw.v !== undefined) {
    return null
  }

  let target: string | null = null
  if (raw.t === 'click') {
    target = cleanTarget(raw.g)
    if (raw.g && !target) return null
  }

  return {
    type: raw.t,
    name: raw.n,
    label: raw.t === 'click' ? cleanLabel(raw.l) || CLICK_NAMES[raw.n as keyof typeof CLICK_NAMES] : null,
    path: raw.p,
    target,
    value,
    referrer: raw.t === 'pageview' ? raw.r ?? null : null,
    utmSource: raw.t === 'pageview' && raw.u ? cleanLabel(raw.u).toLowerCase().slice(0, 60) || null : null,
    ageMs: raw.a ?? 0,
  }
}

// Destinations: internal paths, mailto:/tel: markers, or http(s) URLs
// without query string or fragment (the tracker already strips them; this
// re-checks rather than trusting it).
export function cleanTarget(target: string | undefined): string | null {
  if (!target) return null
  if (target === 'mailto:' || target === 'tel:') return target
  if (target.startsWith('/')) {
    const [path, query] = target.split('?')
    if (!/^\/[\w\-./~%]*$/.test(path) || path.length > 250) return null
    const category = query?.match(/^category=([\w%-]{1,80})$/)?.[1]
    return category ? `${path}?category=${category}` : path
  }
  try {
    const url = new URL(target)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return (url.origin + url.pathname).replace(/\/$/, '').slice(0, 300)
  } catch {
    return null
  }
}

// ---- Request metadata ------------------------------------------------------

const BOT_UA =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link|whatsapp\/|telegrambot|discordbot|curl\/|wget\/|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|postman|phantomjs|puppeteer|playwright|selenium|scrapy|monitor|uptime|pingdom|statuscake|validator/i

export function isBot(userAgent: string | null) {
  if (!userAgent || userAgent.length < 20) return true
  return BOT_UA.test(userAgent)
}

export function deviceFromUserAgent(userAgent: string): Device {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent)) return 'tablet'
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

const SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|baidu\.com|yandex\.[a-z]+|qwant\.com|startpage\.com|search\.brave\.com|kagi\.com|perplexity\.ai)$/
const SOCIAL = /(^|\.)(linkedin\.com|lnkd\.in|t\.co|twitter\.com|x\.com|facebook\.com|fb\.me|instagram\.com|reddit\.com|bsky\.app|threads\.net|mastodon\.[a-z]+|youtube\.com|news\.ycombinator\.com|whatsapp\.com|telegram\.org|t\.me)$/
const EMAIL = /^(mail\.google\.com|outlook\.live\.com|outlook\.office(365)?\.com|mail\.yahoo\.com|mail\.proton\.me)$/
const SOCIAL_SOURCES = /^(linkedin|twitter|x|facebook|instagram|reddit|bluesky|bsky|mastodon|youtube|whatsapp|telegram)$/
const SEARCH_SOURCES = /^(google|bing|duckduckgo|ecosia|yahoo|qwant|kagi)$/

// Referrer host and traffic channel for a landing page view. Internal
// referrers (the site itself) count as direct.
export function classifyReferrer(
  referrer: string | null,
  siteHost: string,
  utmSource: string | null = null,
): { referrerHost: string | null; channel: Channel } {
  if (referrer) {
    let host: string
    try {
      host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      return { referrerHost: null, channel: 'unknown' }
    }
    if (!host) return { referrerHost: null, channel: 'unknown' }
    if (host === siteHost.replace(/^www\./, '')) {
      // Fall through to utm_source / direct.
    } else {
      if (EMAIL.test(host)) return { referrerHost: host, channel: 'email' }
      if (SEARCH.test(host)) return { referrerHost: host, channel: 'search' }
      if (SOCIAL.test(host)) return { referrerHost: host, channel: 'social' }
      return { referrerHost: host, channel: 'referral' }
    }
  }
  if (utmSource) {
    const source = utmSource.toLowerCase()
    const channel: Channel = SOCIAL_SOURCES.test(source)
      ? 'social'
      : SEARCH_SOURCES.test(source)
        ? 'search'
        : /mail|newsletter/.test(source)
          ? 'email'
          : 'referral'
    return { referrerHost: `utm:${source}`, channel }
  }
  return { referrerHost: null, channel: 'direct' }
}

// Country from Netlify's proxy headers: `x-nf-geo` (base64 or plain JSON
// with country.code) or `x-country` (ISO code). Returns an ISO 3166-1
// alpha-2 code or null — never guessed.
export function countryFromHeaders(get: (name: string) => string | null): {
  country: string | null
  source: string | null
} {
  const geo = get('x-nf-geo')
  if (geo) {
    for (const text of [geo, safeBase64(geo)]) {
      if (!text) continue
      try {
        const code = JSON.parse(text)?.country?.code
        if (typeof code === 'string' && /^[A-Za-z]{2}$/.test(code)) {
          return { country: code.toUpperCase(), source: 'x-nf-geo' }
        }
      } catch {
        // try the next form
      }
    }
  }
  const plain = get('x-country')
  if (plain && /^[A-Za-z]{2}$/.test(plain.trim())) {
    return { country: plain.trim().toUpperCase(), source: 'x-country' }
  }
  return { country: null, source: null }
}

function safeBase64(value: string) {
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    return null
  }
}

// The visitor's IP as seen by Netlify's proxy (used only, in memory, to
// compute the daily hash and the rate limit — never stored).
export function clientIp(get: (name: string) => string | null) {
  return (
    get('x-nf-client-connection-ip')?.trim() ||
    get('x-forwarded-for')?.split(',')[0]?.trim() ||
    get('x-real-ip')?.trim() ||
    'unknown'
  )
}

// Do Not Track / Global Privacy Control: honoured on the server too.
export function optedOut(get: (name: string) => string | null) {
  return get('sec-gpc') === '1' || get('dnt') === '1'
}
