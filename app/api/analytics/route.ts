import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { OPT_OUT_COOKIE } from '@/lib/analytics/config'
import { MAX_BODY_BYTES } from '@/lib/analytics/events'
import { storeEvents } from '@/lib/analytics/ingest'
import {
  cleanEvent,
  clientIp,
  countryFromHeaders,
  deviceFromUserAgent,
  isBot,
  optedOut,
  payloadSchema,
} from '@/lib/analytics/validate'

// Public, write-only endpoint for the site's own tracker
// (components/analytics-tracker.tsx). It never returns stored data. Every
// event is checked against an allowlist (lib/analytics/validate.ts); the
// request must come from a page of this site, within the rate limit, from a
// browser that is not a known bot and not opted out (DNT/GPC, the admin's
// "exclude this browser" cookie, or a signed-in admin session).

export const dynamic = 'force-dynamic'

const ignored = () => new NextResponse(null, { status: 204 })

export async function POST(request: NextRequest) {
  const get = (name: string) => request.headers.get(name)

  const declared = Number(get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  // Same-origin only: browsers always send Origin on a cross-site POST, so
  // another website can't submit events on a visitor's behalf.
  const host = request.nextUrl.host
  const origin = get('origin')
  if (origin) {
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {
      originHost = ''
    }
    if (originHost !== host) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (get('sec-fetch-site') !== 'same-origin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (optedOut(get)) return ignored()
  const userAgent = get('user-agent')
  if (isBot(userAgent)) return ignored()

  const ip = clientIp(get)
  if (!rateLimit(clientKey(ip, 'analytics'), 60, 60_000).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (request.cookies.get(OPT_OUT_COOKIE)?.value === '1') return ignored()
  // A Better Auth session cookie means a signed-in admin (sign-up is
  // disabled): their own browsing is not counted. Only checked when the
  // cookie exists, so ordinary visits cost no session lookup.
  if (request.cookies.getAll().some((cookie) => cookie.name.endsWith('better-auth.session_token'))) {
    try {
      const session = await auth.api.getSession({ headers: request.headers })
      if (session?.user) return ignored()
    } catch {
      // Unknown session: treat as a normal visitor.
    }
  }

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const events = parsed.data.e.map(cleanEvent).filter((event) => event !== null)
  if (events.length === 0) return ignored()

  try {
    await storeEvents({
      events,
      ip,
      userAgent: userAgent!,
      siteHost: request.nextUrl.hostname,
      country: countryFromHeaders(get).country,
      device: parsed.data.d ?? deviceFromUserAgent(userAgent!),
    })
  } catch (error) {
    console.error('analytics: could not store events', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
  return ignored()
}
