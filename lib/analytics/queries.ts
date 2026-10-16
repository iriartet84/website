import { pool } from '@/lib/db'
import { ANALYTICS_TIME_ZONE, INTEREST_THEMES, RETENTION_DAYS } from './config'
import { MEANINGFUL_CLICKS } from './events'
import type { Filters, Range } from './range'

// Read side of the analytics: every number on /admin/analytics comes from
// one of these aggregate queries over analytics_events. Server-only, and
// only ever called from pages/routes that have already run requireAdmin().

type Where = { text: string; params: unknown[] }

// WHERE clause for a time window plus the dashboard filters. Referrer and
// channel are stored on every event of a session (copied from its landing
// view), so all filters are plain column comparisons.
export function buildWhere(from: Date, to: Date, filters: Filters, alias = ''): Where {
  const col = (name: string) => (alias ? `${alias}."${name}"` : `"${name}"`)
  const params: unknown[] = [from, to]
  const clauses = [`${col('createdAt')} >= $1`, `${col('createdAt')} < $2`]
  const add = (clause: (placeholder: string) => string, value: unknown) => {
    params.push(value)
    clauses.push(clause(`$${params.length}`))
  }
  if (filters.country === 'unknown') clauses.push(`${col('country')} IS NULL`)
  else if (filters.country) add((p) => `${col('country')} = ${p}`, filters.country)
  if (filters.referrer === 'none') clauses.push(`${col('referrerHost')} IS NULL`)
  else if (filters.referrer) add((p) => `${col('referrerHost')} = ${p}`, filters.referrer)
  if (filters.channel) add((p) => `${col('channel')} = ${p}`, filters.channel)
  if (filters.device) add((p) => `${col('device')} = ${p}`, filters.device)
  if (filters.page) add((p) => `${col('path')} = ${p}`, filters.page)
  return { text: clauses.join(' AND '), params }
}

async function rows<T>(text: string, params: unknown[]): Promise<T[]> {
  return (await pool.query(text, params)).rows as T[]
}

const n = (value: unknown) => Number(value ?? 0)
const MEANINGFUL = `(${MEANINGFUL_CLICKS.map((name) => `'${name}'`).join(', ')})`

// ---- Overview --------------------------------------------------------------

export type Kpis = {
  pageviews: number
  visitors: number
  sessions: number
  clicks: number
  meaningfulClicks: number
  avgEngagedMs: number | null
  timedSessions: number
  topPage: { path: string; views: number } | null
  topClick: { label: string; name: string; clicks: number } | null
}

export async function getKpis(from: Date, to: Date, filters: Filters): Promise<Kpis> {
  const where = buildWhere(from, to, filters)
  const [totals, engaged, topPage, topClick] = await Promise.all([
    rows<Record<string, string>>(
      `SELECT count(*) FILTER (WHERE type = 'pageview') AS pageviews,
              count(DISTINCT "visitorHash") FILTER (WHERE type = 'pageview') AS visitors,
              count(DISTINCT "sessionId") FILTER (WHERE type = 'pageview') AS sessions,
              count(*) FILTER (WHERE type = 'click') AS clicks,
              count(*) FILTER (WHERE type = 'click' AND name IN ${MEANINGFUL}) AS meaningful
         FROM analytics_events WHERE ${where.text}`,
      where.params,
    ),
    // Session duration = visible time on its pages, summed. Only sessions
    // whose browser reported timing count (a tab closed abruptly may not).
    rows<Record<string, string>>(
      `SELECT avg(total) AS avg, count(*) AS sessions FROM (
         SELECT sum(value) AS total FROM analytics_events
          WHERE ${where.text} AND type = 'engagement' GROUP BY "sessionId") t`,
      where.params,
    ),
    rows<{ path: string; views: string }>(
      `SELECT path, count(*) AS views FROM analytics_events
        WHERE ${where.text} AND type = 'pageview' GROUP BY path ORDER BY views DESC, path LIMIT 1`,
      where.params,
    ),
    rows<{ label: string; name: string; clicks: string }>(
      `SELECT label, min(name) AS name, count(*) AS clicks FROM analytics_events
        WHERE ${where.text} AND type = 'click' GROUP BY label ORDER BY clicks DESC, label LIMIT 1`,
      where.params,
    ),
  ])
  const t = totals[0]
  return {
    pageviews: n(t.pageviews),
    visitors: n(t.visitors),
    sessions: n(t.sessions),
    clicks: n(t.clicks),
    meaningfulClicks: n(t.meaningful),
    avgEngagedMs: engaged[0].avg === null ? null : Math.round(n(engaged[0].avg)),
    timedSessions: n(engaged[0].sessions),
    topPage: topPage[0] ? { path: topPage[0].path, views: n(topPage[0].views) } : null,
    topClick: topClick[0] ? { label: topClick[0].label, name: topClick[0].name, clicks: n(topClick[0].clicks) } : null,
  }
}

export type SeriesPoint = { bucket: string; pageviews: number; visitors: number }

// One point per local day (or hour, for a single day), gaps filled with 0.
export async function getTimeseries(range: Range, filters: Filters, from = range.from, to = range.to) {
  const where = buildWhere(from, to, filters)
  const unit = range.bucket
  const data = await rows<{ bucket: string; pageviews: string; visitors: string }>(
    `SELECT to_char(date_trunc('${unit}', "createdAt" AT TIME ZONE '${ANALYTICS_TIME_ZONE}'), ${
      unit === 'hour' ? `'YYYY-MM-DD"T"HH24'` : `'YYYY-MM-DD'`
    }) AS bucket,
            count(*) FILTER (WHERE type = 'pageview') AS pageviews,
            count(DISTINCT "visitorHash") FILTER (WHERE type = 'pageview') AS visitors
       FROM analytics_events WHERE ${where.text} GROUP BY 1 ORDER BY 1`,
    where.params,
  )
  const byBucket = new Map(data.map((row) => [row.bucket, row]))
  const points: SeriesPoint[] = []
  const startDay = new Date(from.getTime() + 12 * 3_600_000) // inside the first local day
  const first = new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(unit === 'hour' ? from : startDay)
  if (unit === 'hour') {
    for (let h = 0; h < 24; h++) {
      const bucket = `${first}T${String(h).padStart(2, '0')}`
      const row = byBucket.get(bucket)
      points.push({ bucket, pageviews: n(row?.pageviews), visitors: n(row?.visitors) })
    }
  } else {
    const [y, m, d] = first.split('-').map(Number)
    for (let i = 0; i < range.days; i++) {
      const bucket = new Date(Date.UTC(y, m - 1, d) + i * 86_400_000).toISOString().slice(0, 10)
      const row = byBucket.get(bucket)
      points.push({ bucket, pageviews: n(row?.pageviews), visitors: n(row?.visitors) })
    }
  }
  return points
}

// ---- Origins ---------------------------------------------------------------

export type BreakdownRow = { key: string | null; visitors: number; sessions: number; pageviews: number }

export async function getBreakdown(
  dimension: 'country' | 'referrerHost' | 'channel' | 'device',
  from: Date,
  to: Date,
  filters: Filters,
  limit = 50,
): Promise<BreakdownRow[]> {
  const where = buildWhere(from, to, filters)
  const data = await rows<Record<string, string | null>>(
    `SELECT "${dimension}" AS key,
            count(DISTINCT "visitorHash") AS visitors,
            count(DISTINCT "sessionId") AS sessions,
            count(*) AS pageviews
       FROM analytics_events WHERE ${where.text} AND type = 'pageview'
      GROUP BY 1 ORDER BY sessions DESC, pageviews DESC LIMIT ${limit}`,
    where.params,
  )
  return data.map((row) => ({
    key: row.key,
    visitors: n(row.visitors),
    sessions: n(row.sessions),
    pageviews: n(row.pageviews),
  }))
}

// First (landing) or last (exit) page view of each session.
export async function getEdgePages(which: 'landing' | 'exit', from: Date, to: Date, filters: Filters, limit = 20) {
  const where = buildWhere(from, to, filters)
  const order = which === 'landing' ? 'ASC' : 'DESC'
  const data = await rows<{ path: string; sessions: string }>(
    `SELECT path, count(*) AS sessions FROM (
       SELECT DISTINCT ON ("sessionId") "sessionId", path FROM analytics_events
        WHERE ${where.text} AND type = 'pageview'
        ORDER BY "sessionId", "createdAt" ${order}) s
      GROUP BY path ORDER BY sessions DESC, path LIMIT ${limit}`,
    where.params,
  )
  return data.map((row) => ({ path: row.path, sessions: n(row.sessions) }))
}

// ---- Attention & engagement ------------------------------------------------

export type PageRow = {
  path: string
  title: string | null
  views: number
  visitors: number
  sessions: number
  avgEngagedMs: number | null
  clicks: number
  meaningfulSessions: number
  outbound: number
  scroll50: number
  scroll75: number
  scroll90: number
  scrollable: number
}

export async function getPages(from: Date, to: Date, filters: Filters, limit = 60): Promise<PageRow[]> {
  const where = buildWhere(from, to, filters)
  const data = await rows<Record<string, string | null>>(
    `WITH ev AS (SELECT * FROM analytics_events WHERE ${where.text}),
     views AS (
       SELECT path, count(*) AS views, count(DISTINCT "visitorHash") AS visitors,
              count(DISTINCT "sessionId") AS sessions
         FROM ev WHERE type = 'pageview' GROUP BY path),
     engaged AS (
       SELECT path, sum(value) AS ms FROM ev WHERE type = 'engagement' GROUP BY path),
     clicks AS (
       SELECT path, count(*) AS clicks,
              count(DISTINCT "sessionId") FILTER (WHERE name IN ${MEANINGFUL}) AS meaningful_sessions,
              count(*) FILTER (WHERE name IN ('outbound', 'whatsapp')) AS outbound
         FROM ev WHERE type = 'click' GROUP BY path),
     depth AS (
       SELECT path, count(*) AS scrollable,
              count(*) FILTER (WHERE max_depth >= 50) AS s50,
              count(*) FILTER (WHERE max_depth >= 75) AS s75,
              count(*) FILTER (WHERE max_depth >= 90) AS s90
         FROM (SELECT path, "sessionId", max(value) AS max_depth FROM ev
                WHERE type = 'scroll' GROUP BY path, "sessionId") d GROUP BY path)
     SELECT v.path, v.views, v.visitors, v.sessions,
            e.ms / NULLIF(v.views, 0) AS avg_ms,
            coalesce(c.clicks, 0) AS clicks, coalesce(c.meaningful_sessions, 0) AS meaningful_sessions,
            coalesce(c.outbound, 0) AS outbound,
            coalesce(d.s50, 0) AS s50, coalesce(d.s75, 0) AS s75, coalesce(d.s90, 0) AS s90,
            coalesce(d.scrollable, 0) AS scrollable,
            coalesce(p.title, pr.title) AS title
       FROM views v
       LEFT JOIN engaged e USING (path)
       LEFT JOIN clicks c USING (path)
       LEFT JOIN depth d USING (path)
       LEFT JOIN paper_entries p ON v.path = '/papers/' || p.slug
       LEFT JOIN project_entries pr ON v.path = '/projects/' || pr.slug
      ORDER BY v.views DESC, v.path LIMIT ${limit}`,
    where.params,
  )
  return data.map((row) => ({
    path: row.path!,
    title: row.title,
    views: n(row.views),
    visitors: n(row.visitors),
    sessions: n(row.sessions),
    avgEngagedMs: row.avg_ms === null ? null : Math.round(n(row.avg_ms)),
    clicks: n(row.clicks),
    meaningfulSessions: n(row.meaningful_sessions),
    outbound: n(row.outbound),
    scroll50: n(row.s50),
    scroll75: n(row.s75),
    scroll90: n(row.s90),
    scrollable: n(row.scrollable),
  }))
}

export type ClickRow = { name: string; label: string; target: string | null; clicks: number; sessions: number }

export async function getClicks(
  from: Date,
  to: Date,
  filters: Filters,
  names: string[] | null,
  limit = 25,
  groupByHost = false,
): Promise<ClickRow[]> {
  const where = buildWhere(from, to, filters)
  const params = [...where.params]
  let nameClause = ''
  if (names) {
    params.push(names)
    nameClause = `AND name = ANY($${params.length})`
  }
  const targetExpr = groupByHost
    ? `CASE WHEN target ~ '^https?://' THEN substring(target from '^https?://([^/]+)') ELSE target END`
    : 'target'
  const labelExpr = groupByHost ? `min(label)` : 'label'
  const data = await rows<Record<string, string | null>>(
    `SELECT min(name) AS name, ${labelExpr} AS label, ${targetExpr} AS target,
            count(*) AS clicks, count(DISTINCT "sessionId") AS sessions
       FROM analytics_events WHERE ${where.text} AND type = 'click' ${nameClause}
      GROUP BY ${groupByHost ? '3' : '2, 3'} ORDER BY clicks DESC, 2 LIMIT ${limit}`,
    params,
  )
  return data.map((row) => ({
    name: row.name!,
    label: row.label ?? '',
    target: row.target,
    clicks: n(row.clicks),
    sessions: n(row.sessions),
  }))
}

// ---- Journeys --------------------------------------------------------------

// The first three pages of each session, as a path ("/ → /papers → …").
export async function getCommonPaths(from: Date, to: Date, filters: Filters, limit = 12) {
  const where = buildWhere(from, to, filters)
  const data = await rows<{ steps: string[]; sessions: string }>(
    `SELECT steps, count(*) AS sessions FROM (
       SELECT "sessionId", (array_agg(path ORDER BY "createdAt"))[1:3] AS steps
         FROM (SELECT "sessionId", path, "createdAt",
                      lag(path) OVER (PARTITION BY "sessionId" ORDER BY "createdAt") AS prev
                 FROM analytics_events WHERE ${where.text} AND type = 'pageview') v
        WHERE prev IS DISTINCT FROM path
        GROUP BY "sessionId") s
      GROUP BY steps ORDER BY sessions DESC, steps LIMIT ${limit}`,
    where.params,
  )
  return data.map((row) => ({ steps: row.steps, sessions: n(row.sessions) }))
}

// Where visitors go after a page: next page view in the same session, or
// "exit" when it was their last.
export async function getTransitions(from: Date, to: Date, filters: Filters) {
  const where = buildWhere(from, to, filters)
  const data = await rows<{ path: string; next: string | null; sessions: string }>(
    `SELECT path, next, count(DISTINCT "sessionId") AS sessions FROM (
       SELECT "sessionId", path, lead(path) OVER (PARTITION BY "sessionId" ORDER BY "createdAt") AS next
         FROM analytics_events WHERE ${where.text} AND type = 'pageview') t
      WHERE next IS DISTINCT FROM path
      GROUP BY path, next ORDER BY sessions DESC`,
    where.params,
  )
  return data.map((row) => ({ path: row.path, next: row.next, sessions: n(row.sessions) }))
}

export type JourneyStep = {
  type: string
  name: string
  label: string | null
  path: string
  target: string | null
  createdAt: Date
}
export type Journey = {
  sessionId: string
  start: Date
  country: string | null
  device: string | null
  channel: string | null
  referrerHost: string | null
  engagedMs: number
  steps: JourneyStep[]
}

export async function getRecentJourneys(from: Date, to: Date, filters: Filters, limit = 12): Promise<Journey[]> {
  const where = buildWhere(from, to, filters)
  const data = await rows<Record<string, unknown>>(
    `WITH s AS (
       SELECT "sessionId", min("createdAt") AS start FROM analytics_events
        WHERE ${where.text} AND type = 'pageview'
        GROUP BY "sessionId" ORDER BY start DESC LIMIT ${limit})
     SELECT e."sessionId", s.start, e.type, e.name, e.label, e.path, e.target, e."createdAt",
            e.country, e.device, e.channel, e."referrerHost", e.value
       FROM analytics_events e JOIN s USING ("sessionId")
      WHERE e."createdAt" >= $1 AND e."createdAt" < $2
      ORDER BY s.start DESC, e."createdAt"`,
    where.params,
  )
  const journeys = new Map<string, Journey>()
  for (const row of data) {
    const id = row.sessionId as string
    let journey = journeys.get(id)
    if (!journey) {
      journey = {
        sessionId: id,
        start: row.start as Date,
        country: row.country as string | null,
        device: row.device as string | null,
        channel: row.channel as string | null,
        referrerHost: row.referrerHost as string | null,
        engagedMs: 0,
        steps: [],
      }
      journeys.set(id, journey)
    }
    if (row.type === 'engagement') journey.engagedMs += n(row.value)
    if (row.type === 'pageview' || row.type === 'click') {
      journey.steps.push({
        type: row.type as string,
        name: row.name as string,
        label: row.label as string | null,
        path: row.path as string,
        target: row.target as string | null,
        createdAt: row.createdAt as Date,
      })
    }
  }
  return [...journeys.values()]
}

// ---- Event log and live feed ----------------------------------------------

export type EventRow = {
  id: number
  createdAt: Date
  type: string
  name: string
  label: string | null
  path: string
  target: string | null
  referrerHost: string | null
  channel: string | null
  country: string | null
  device: string | null
  value: number | null
  sessionId: string
}

const EVENT_COLUMNS = `id, "createdAt", type, name, label, path, target, "referrerHost", channel, country, device, value, "sessionId"`

function toEventRow(row: Record<string, unknown>): EventRow {
  return { ...(row as EventRow), id: n(row.id), value: row.value === null ? null : n(row.value) }
}

export async function getEventLog(
  from: Date,
  to: Date,
  filters: Filters,
  options: { type?: string | null; destination?: string | null; page: number; pageSize: number },
) {
  const where = buildWhere(from, to, filters)
  const params = [...where.params]
  let extra = ''
  if (options.type) {
    params.push(options.type)
    extra += ` AND type = $${params.length}`
  }
  if (options.destination) {
    params.push(`%${options.destination.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
    extra += ` AND target ILIKE $${params.length}`
  }
  const [count, data] = await Promise.all([
    rows<{ total: string }>(`SELECT count(*) AS total FROM analytics_events WHERE ${where.text}${extra}`, params),
    rows<Record<string, unknown>>(
      `SELECT ${EVENT_COLUMNS} FROM analytics_events WHERE ${where.text}${extra}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${options.pageSize} OFFSET ${(options.page - 1) * options.pageSize}`,
      params,
    ),
  ])
  return { total: n(count[0].total), rows: data.map(toEventRow) }
}

// Newest page views and clicks, for the live activity feed.
export async function getFeed(afterId: number | null, limit = 30) {
  const params: unknown[] = []
  let clause = ''
  if (afterId) {
    params.push(afterId)
    clause = `AND id > $1`
  }
  const data = await rows<Record<string, unknown>>(
    `SELECT ${EVENT_COLUMNS} FROM analytics_events
      WHERE type IN ('pageview', 'click') ${clause}
        AND "createdAt" > now() - interval '7 days'
      ORDER BY id DESC LIMIT ${limit}`,
    params,
  )
  return data.map(toEventRow)
}

// ---- Portfolio Interest ----------------------------------------------------

export type ThemeRow = { id: string; label: string; views: number; clicks: number; sessions: number }

export function themeFor(input: { category?: string | null; text: string }): string | null {
  const category = input.category?.toLowerCase()
  const text = input.text.toLowerCase()
  for (const theme of INTEREST_THEMES) {
    if (category && theme.categories.some((c) => c.toLowerCase() === category)) return theme.id
  }
  // Otherwise the theme with the longest matching keyword wins ("emerging
  // markets" beats "markets"). Category slugs in links
  // (?category=commodity-research) and category names count as keywords.
  let best: { id: string; length: number } | null = null
  for (const theme of INTEREST_THEMES) {
    const words = [
      ...theme.keywords,
      ...theme.categories.map((c) => c.toLowerCase()),
      ...theme.categories.map((c) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-')),
    ]
    for (const word of words) {
      if (word && text.includes(word) && (!best || word.length > best.length)) best = { id: theme.id, length: word.length }
    }
  }
  return best?.id ?? null
}

export async function getInterest(from: Date, to: Date, filters: Filters): Promise<ThemeRow[]> {
  const where = buildWhere(from, to, filters, 'e')
  const data = await rows<Record<string, string | null>>(
    `SELECT e."sessionId", e.type, e.path, e.label, e.target,
            coalesce(p.category, pr.category, tp.category, tpr.category) AS category
       FROM analytics_events e
       LEFT JOIN paper_entries p ON e.type = 'pageview' AND e.path = '/papers/' || p.slug
       LEFT JOIN project_entries pr ON e.type = 'pageview' AND e.path = '/projects/' || pr.slug
       LEFT JOIN paper_entries tp ON e.type = 'click' AND e.target = '/papers/' || tp.slug
       LEFT JOIN project_entries tpr ON e.type = 'click' AND e.target = '/projects/' || tpr.slug
      WHERE ${where.text}
        AND (e.type = 'pageview' OR (e.type = 'click' AND e.name IN ${MEANINGFUL}))
      LIMIT 50000`,
    where.params,
  )
  const totals = new Map(INTEREST_THEMES.map((t) => [t.id, { views: 0, clicks: 0, sessions: new Set<string>() }]))
  for (const row of data) {
    const id = themeFor({
      category: row.category,
      text: [row.path, row.label, row.target].filter(Boolean).join(' '),
    })
    const bucket = id ? totals.get(id) : undefined
    if (!bucket) continue
    if (row.type === 'pageview') bucket.views++
    else bucket.clicks++
    bucket.sessions.add(row.sessionId!)
  }
  return INTEREST_THEMES.map((theme) => {
    const t = totals.get(theme.id)!
    return { id: theme.id, label: theme.label, views: t.views, clicks: t.clicks, sessions: t.sessions.size }
  }).sort((a, b) => b.sessions - a.sessions || b.views - a.views)
}

// ---- Data health -----------------------------------------------------------

export async function getDataHealth() {
  const data = await rows<Record<string, unknown>>(
    `SELECT count(*) AS total, min("createdAt") AS first, max("createdAt") AS last,
            count(*) FILTER (WHERE type = 'pageview') AS pageviews,
            count(*) FILTER (WHERE type = 'pageview' AND country IS NOT NULL) AS with_country,
            count(*) FILTER (WHERE "createdAt" < now() - make_interval(days => $1)) AS expired
       FROM analytics_events`,
    [RETENTION_DAYS],
  )
  const row = data[0]
  return {
    total: n(row.total),
    first: (row.first as Date | null) ?? null,
    last: (row.last as Date | null) ?? null,
    pageviews: n(row.pageviews),
    withCountry: n(row.with_country),
    expired: n(row.expired),
  }
}

// All page paths seen, for the page selector.
export async function getKnownPages(): Promise<{ path: string; title: string | null }[]> {
  return rows(
    `SELECT DISTINCT e.path, coalesce(p.title, pr.title) AS title
       FROM analytics_events e
       LEFT JOIN paper_entries p ON e.path = '/papers/' || p.slug
       LEFT JOIN project_entries pr ON e.path = '/projects/' || pr.slug
      WHERE e.type = 'pageview' ORDER BY e.path LIMIT 500`,
    [],
  )
}
