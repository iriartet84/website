import { ANALYTICS_TIME_ZONE } from './config'
import { CHANNELS, DEVICES, type Channel, type Device } from './events'
import { isTrackablePath } from './validate'

// Date range and filters of /admin/analytics, parsed from the URL. Pure and
// unit-tested: days start at local midnight in ANALYTICS_TIME_ZONE (DST
// included), and the end of a range is exclusive.

export type RangeKey = 'today' | '7d' | '30d' | 'custom'

export type Filters = {
  country: string | null // ISO code, or "unknown"
  referrer: string | null // host, or "none"
  channel: Channel | null
  device: Device | null
  page: string | null
}

export type Range = {
  key: RangeKey
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
  days: number
  bucket: 'hour' | 'day'
  fromDay: string // YYYY-MM-DD, inclusive
  toDay: string // YYYY-MM-DD, inclusive
  label: string
}

const DAY_MS = 86_400_000
const MAX_CUSTOM_DAYS = 400

// Offset (ms) of `timeZone` from UTC at the given instant.
function offsetAt(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

// The UTC instant of local midnight starting `day` (YYYY-MM-DD).
export function startOfDay(day: string, timeZone = ANALYTICS_TIME_ZONE): Date {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  let instant = guess - offsetAt(guess, timeZone)
  // Re-check once: the offset can differ at the corrected instant (DST).
  instant = guess - offsetAt(instant, timeZone)
  return new Date(instant)
}

export function localDay(date: Date, timeZone = ANALYTICS_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10)
}

function isDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

const formatDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function parseRange(
  params: { range?: string; from?: string; to?: string },
  now = new Date(),
  timeZone = ANALYTICS_TIME_ZONE,
): Range {
  const today = localDay(now, timeZone)
  let key: RangeKey = params.range === 'today' || params.range === '30d' || params.range === 'custom' ? params.range : '7d'
  let fromDay: string
  let toDay: string

  if (key === 'custom' && isDay(params.from) && isDay(params.to)) {
    fromDay = params.from <= params.to ? params.from : params.to
    toDay = params.from <= params.to ? params.to : params.from
    if (toDay > today) toDay = today
    if (fromDay > toDay) fromDay = toDay
    if (daysBetween(fromDay, toDay) + 1 > MAX_CUSTOM_DAYS) fromDay = addDays(toDay, -(MAX_CUSTOM_DAYS - 1))
  } else {
    if (key === 'custom') key = '7d'
    toDay = today
    fromDay = key === 'today' ? today : addDays(today, key === '30d' ? -29 : -6)
  }

  const days = daysBetween(fromDay, toDay) + 1
  const prevFromDay = addDays(fromDay, -days)
  const label =
    key === 'today'
      ? 'Today'
      : key === '7d'
        ? 'Last 7 days'
        : key === '30d'
          ? 'Last 30 days'
          : fromDay === toDay
            ? formatDay(fromDay)
            : `${formatDay(fromDay)} – ${formatDay(toDay)}`

  return {
    key,
    from: startOfDay(fromDay, timeZone),
    to: startOfDay(addDays(toDay, 1), timeZone),
    prevFrom: startOfDay(prevFromDay, timeZone),
    prevTo: startOfDay(fromDay, timeZone),
    days,
    bucket: days === 1 ? 'hour' : 'day',
    fromDay,
    toDay,
    label,
  }
}

export function parseFilters(params: Record<string, string | undefined>): Filters {
  const country = params.country?.toUpperCase()
  const channel = params.channel as Channel | undefined
  const device = params.device as Device | undefined
  const referrer = params.referrer?.toLowerCase()
  return {
    country: country && (/^[A-Z]{2}$/.test(country) || country === 'UNKNOWN') ? (country === 'UNKNOWN' ? 'unknown' : country) : null,
    referrer: referrer && /^[a-z0-9.:_-]{1,120}$/.test(referrer) ? referrer : null,
    channel: channel && (CHANNELS as readonly string[]).includes(channel) ? channel : null,
    device: device && (DEVICES as readonly string[]).includes(device) ? device : null,
    page: params.page && isTrackablePath(params.page) ? params.page : null,
  }
}

// URL for the dashboard with some parameters changed (null removes one).
export function dashboardHref(
  current: Record<string, string | undefined>,
  changes: Record<string, string | null>,
  hash = '',
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(current)) if (value) params.set(key, value)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  // Paging restarts whenever anything else changes.
  if (!('p' in changes)) params.delete('p')
  const query = params.toString()
  return `/admin/analytics${query ? `?${query}` : ''}${hash}`
}
