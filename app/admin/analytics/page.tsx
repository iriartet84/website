import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import { ANALYTICS_TIME_ZONE, OPT_OUT_COOKIE, RETENTION_DAYS } from '@/lib/analytics/config'
import { CHANNELS, CLICK_NAMES, EVENT_TYPES } from '@/lib/analytics/events'
import { dashboardHref, parseFilters, parseRange } from '@/lib/analytics/range'
import { countryFromHeaders } from '@/lib/analytics/validate'
import {
  getBreakdown,
  getClicks,
  getCommonPaths,
  getDataHealth,
  getEdgePages,
  getEventLog,
  getFeed,
  getInterest,
  getKnownPages,
  getKpis,
  getPages,
  getRecentJourneys,
  getTimeseries,
  getTransitions,
} from '@/lib/analytics/queries'
import {
  CHANNEL_LABELS,
  EVENT_TYPE_LABELS,
  countryName,
  describeEvent,
  eventName,
  formatDateTime,
  formatDuration,
  formatGap,
  formatNumber,
  formatPercent,
  formatTime,
  pageName,
  shortSession,
} from '@/lib/analytics/format'
import { SeriesChart } from '@/components/admin/analytics/series-chart'
import { SortableTable, type Row } from '@/components/admin/analytics/sortable-table'
import { LiveFeed } from '@/components/admin/analytics/live-feed'
import { Chip, Delta, Empty, Kpi, Panel, Section } from '@/components/admin/analytics/panels'
import { deleteAllEvents, purgeOldEvents, setExcludeThisBrowser } from './actions'

export const metadata: Metadata = { title: 'Analytics', robots: { index: false } }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const RESEARCH_CLICKS = ['paper_open', 'project_open', 'research_theme_open', 'file_download', 'cv_download']

const SECTIONS = [
  ['overview', 'Overview'],
  ['origins', 'Origins'],
  ['interest', 'Interest'],
  ['attention', 'Attention'],
  ['journeys', 'Journeys'],
  ['activity', 'Activity'],
  ['data', 'Data & privacy'],
] as const

type Params = Record<string, string | undefined>

const plural = (count: number, noun: string) => `${formatNumber(count)} ${noun}${count === 1 ? '' : 's'}`

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The admin layout already redirects signed-out visitors; this page reads
  // analytics data, so it checks again itself.
  if (!(await requireAdmin())) redirect('/login')

  const raw = await searchParams
  const sp: Params = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
  const range = parseRange(sp)
  const filters = parseFilters(sp)
  const compare = sp.cmp !== '0'
  const eventType = sp.etype && (EVENT_TYPES as readonly string[]).includes(sp.etype) ? sp.etype : null
  const destination = sp.dest?.trim().slice(0, 100) || null
  const logPage = Math.max(1, Math.min(1000, Number(sp.p) || 1))
  const href = (changes: Record<string, string | null>, hash = '') => dashboardHref(sp, changes, hash)

  const requestHeaders = await headers()
  const geoHere = countryFromHeaders((name) => requestHeaders.get(name))
  const excluded = (await cookies()).get(OPT_OUT_COOKIE)?.value === '1'

  let data
  try {
    const { from, to, prevFrom, prevTo } = range
    const [
      kpis,
      prevKpis,
      series,
      prevSeries,
      countries,
      referrers,
      channels,
      devices,
      landing,
      exits,
      pages,
      researchClicks,
      outbound,
      allClicks,
      commonPaths,
      transitions,
      journeys,
      log,
      feed,
      interest,
      health,
      knownPages,
    ] = await Promise.all([
      getKpis(from, to, filters),
      compare ? getKpis(prevFrom, prevTo, filters) : Promise.resolve(null),
      getTimeseries(range, filters),
      compare ? getTimeseries(range, filters, prevFrom, prevTo) : Promise.resolve(null),
      getBreakdown('country', from, to, filters),
      getBreakdown('referrerHost', from, to, filters),
      getBreakdown('channel', from, to, filters),
      getBreakdown('device', from, to, filters),
      getEdgePages('landing', from, to, filters),
      getEdgePages('exit', from, to, filters),
      getPages(from, to, filters),
      getClicks(from, to, filters, RESEARCH_CLICKS),
      getClicks(from, to, filters, ['outbound', 'whatsapp'], 25, true),
      getClicks(from, to, filters, null, 40),
      getCommonPaths(from, to, filters),
      getTransitions(from, to, filters),
      getRecentJourneys(from, to, filters),
      getEventLog(from, to, filters, { type: eventType, destination, page: logPage, pageSize: PAGE_SIZE }),
      getFeed(null),
      getInterest(from, to, filters),
      getDataHealth(),
      getKnownPages(),
    ])
    data = {
      kpis, prevKpis, series, prevSeries, countries, referrers, channels, devices, landing, exits, pages,
      researchClicks, outbound, allClicks, commonPaths, transitions, journeys, log, feed, interest, health, knownPages,
    }
  } catch (error) {
    const missing = (error as { code?: string })?.code === '42P01'
    return (
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <h1 className="font-serif text-4xl tracking-tight text-navy">Analytics</h1>
        <p className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {missing
            ? 'The analytics tables do not exist yet. Run `npm run db:push` against this database, then reload.'
            : 'Analytics data could not be loaded — the database may be unreachable. Try again in a moment.'}
        </p>
      </main>
    )
  }

  const { kpis, prevKpis, health } = data
  const titles = new Map(data.knownPages.map((p) => [p.path, p.title]))
  const name = (path: string) => pageName(path, titles.get(path))
  const hasData = health.total > 0
  const showDelta = Boolean(prevKpis && prevKpis.pageviews > 0)
  const activeFilters = [
    filters.page && { key: 'page', label: `Page: ${name(filters.page)}` },
    filters.country && { key: 'country', label: `Country: ${countryName(filters.country === 'unknown' ? null : filters.country)}` },
    filters.referrer && { key: 'referrer', label: `Referrer: ${filters.referrer === 'none' ? 'none' : filters.referrer}` },
    filters.channel && { key: 'channel', label: `Channel: ${CHANNEL_LABELS[filters.channel]}` },
    filters.device && { key: 'device', label: `Device: ${filters.device}` },
  ].filter(Boolean) as { key: string; label: string }[]

  // ---- Table rows ----------------------------------------------------------

  const breakdownRows = (
    rows: typeof data.countries,
    param: string,
    label: (key: string | null) => string,
    keyOf: (key: string | null) => string,
    current: string | null,
  ): Row[] =>
    rows.map((row) => ({
      id: keyOf(row.key),
      href: href({ [param]: keyOf(row.key) }, '#origins'),
      active: current === keyOf(row.key),
      cells: {
        name: { display: label(row.key), sort: label(row.key) },
        visitors: { display: formatNumber(row.visitors), sort: row.visitors },
        sessions: { display: formatNumber(row.sessions), sort: row.sessions },
        pageviews: { display: formatNumber(row.pageviews), sort: row.pageviews },
      },
    }))

  const originColumns = (title: string) => [
    { key: 'name', label: title },
    { key: 'visitors', label: 'Visitors', numeric: true },
    { key: 'sessions', label: 'Sessions', numeric: true, bar: true },
    { key: 'pageviews', label: 'Views', numeric: true },
  ]

  const pageRows: Row[] = data.pages.map((p) => ({
    id: p.path,
    href: href({ page: p.path }, '#attention'),
    active: filters.page === p.path,
    cells: {
      name: { display: name(p.path), sort: name(p.path), hint: p.path },
      views: { display: formatNumber(p.views), sort: p.views },
      visitors: { display: formatNumber(p.visitors), sort: p.visitors },
      time: { display: formatDuration(p.avgEngagedMs), sort: p.avgEngagedMs ?? -1 },
      interaction: {
        display: formatPercent(p.meaningfulSessions, p.sessions),
        sort: p.sessions ? p.meaningfulSessions / p.sessions : -1,
        hint: `${p.meaningfulSessions} of ${p.sessions} sessions`,
      },
      read: {
        display: p.scrollable ? formatPercent(p.scroll75, p.scrollable) : '—',
        sort: p.scrollable ? p.scroll75 / p.scrollable : -1,
        hint: p.scrollable ? `${p.scroll75} of ${p.scrollable} scrolling sessions reached 75%` : 'Page too short to scroll',
      },
      outbound: { display: formatNumber(p.outbound), sort: p.outbound },
    },
  }))

  const clickRows = (rows: typeof data.researchClicks, withTarget = true): Row[] =>
    rows.map((c, i) => ({
      id: `${c.label}-${c.target}-${i}`,
      cells: {
        name: { display: c.label || eventName(c.name), sort: c.label, hint: withTarget ? c.target ?? undefined : undefined },
        kind: { display: eventName(c.name), sort: c.name },
        target: { display: c.target ?? '—', sort: c.target ?? '' },
        clicks: { display: formatNumber(c.clicks), sort: c.clicks },
        sessions: { display: formatNumber(c.sessions), sort: c.sessions },
      },
    }))

  const researchPages = data.pages.filter((p) => /^\/(papers|projects)\/./.test(p.path))
  const researchPageRows: Row[] = researchPages.map((p) => ({
    id: p.path,
    href: href({ page: p.path }, '#attention'),
    cells: {
      name: { display: name(p.path), sort: name(p.path), hint: p.path },
      views: { display: formatNumber(p.views), sort: p.views },
      visitors: { display: formatNumber(p.visitors), sort: p.visitors },
      time: { display: formatDuration(p.avgEngagedMs), sort: p.avgEngagedMs ?? -1 },
    },
  }))

  // Next steps after each page (top pages only), and exit rates.
  const nextByPage = new Map<string, { next: string | null; sessions: number }[]>()
  for (const t of data.transitions) {
    const list = nextByPage.get(t.path) ?? []
    list.push({ next: t.next, sessions: t.sessions })
    nextByPage.set(t.path, list)
  }
  const journeyPages = data.pages.slice(0, 8).filter((p) => nextByPage.has(p.path))

  const viewedNoInteraction = data.pages.filter((p) => p.sessions >= 3 && p.meaningfulSessions === 0)
  const maxSessions = Math.max(1, ...data.pages.map((p) => p.sessions))
  const interestMax = Math.max(1, ...data.interest.map((t) => t.sessions))
  const totalPages = Math.max(1, Math.ceil(data.log.total / PAGE_SIZE))
  const countryShare = health.pageviews ? health.withCountry / health.pageviews : null

  const hidden = (keys: string[]) =>
    Object.entries(sp)
      .filter(([key, value]) => value && !keys.includes(key) && key !== 'notice' && key !== 'p')
      .map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
      {sp.notice && (
        <p role="status" className="mb-6 rounded-xl bg-steel/10 px-4 py-3 text-sm text-navy">
          {sp.notice}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">Private analytics</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-navy md:text-5xl">Analytics</h1>
        </div>
        <p className="mb-1 ml-auto text-xs text-muted-foreground">
          {range.label} · times in {ANALYTICS_TIME_ZONE.replace('_', ' ')}
        </p>
      </div>

      {/* Controls: date range, comparison, page drill-down, active filters */}
      <div className="z-30 -mx-5 mt-6 md:sticky md:top-14 border-b border-border bg-background/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-secondary p-0.5 text-sm" role="group" aria-label="Date range">
            {(
              [
                ['today', 'Today'],
                ['7d', '7 days'],
                ['30d', '30 days'],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={href({ range: key, from: null, to: null })}
                aria-current={range.key === key ? 'true' : undefined}
                className={
                  range.key === key
                    ? 'rounded-full bg-white px-3 py-1 font-medium text-navy shadow-sm'
                    : 'rounded-full px-3 py-1 text-muted-foreground hover:text-navy'
                }
              >
                {label}
              </Link>
            ))}
          </div>
          <form action="/admin/analytics" className="flex flex-wrap items-center gap-1.5 text-sm">
            {hidden(['range', 'from', 'to'])}
            <input type="hidden" name="range" value="custom" />
            <label className="sr-only" htmlFor="from">From</label>
            <input id="from" type="date" name="from" defaultValue={range.fromDay} required className="rounded-lg border border-border bg-white px-2 py-1 text-xs" />
            <span className="text-muted-foreground">–</span>
            <label className="sr-only" htmlFor="to">To</label>
            <input id="to" type="date" name="to" defaultValue={range.toDay} required className="rounded-lg border border-border bg-white px-2 py-1 text-xs" />
            <button type="submit" className={range.key === 'custom' ? 'rounded-full bg-navy px-3 py-1 text-xs text-white' : 'rounded-full border border-border px-3 py-1 text-xs text-navy hover:bg-secondary'}>
              Custom
            </button>
          </form>
          <Link
            href={href({ cmp: compare ? '0' : null })}
            className="rounded-full border border-border px-3 py-1 text-xs text-navy hover:bg-secondary"
            aria-pressed={compare}
          >
            {compare ? '✓ ' : ''}Compare with previous period
          </Link>
          <form action="/admin/analytics" className="ml-auto flex items-center gap-1.5">
            {hidden(['page'])}
            <label htmlFor="page-select" className="text-xs text-muted-foreground">Page</label>
            <select id="page-select" name="page" defaultValue={filters.page ?? ''} className="max-w-56 rounded-lg border border-border bg-white px-2 py-1 text-xs">
              <option value="">All pages</option>
              {data.knownPages.map((p) => (
                <option key={p.path} value={p.path}>
                  {pageName(p.path, p.title)}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full border border-border px-3 py-1 text-xs text-navy hover:bg-secondary">
              Apply
            </button>
          </form>
        </div>
        {activeFilters.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <Chip key={f.key} label={f.label} removeHref={href({ [f.key]: null })} />
            ))}
            <Link
              href={href({ page: null, country: null, referrer: null, channel: null, device: null })}
              className="text-xs text-steel-700 hover:text-navy"
            >
              Clear all
            </Link>
          </div>
        )}
        <nav aria-label="Sections" className="mt-2 flex gap-4 overflow-x-auto text-xs">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 text-muted-foreground hover:text-navy">
              {label}
            </a>
          ))}
        </nav>
      </div>

      {!hasData && (
        <div className="mt-8 rounded-2xl border border-dashed border-steel/40 bg-white p-6 text-sm text-muted-foreground">
          <p className="font-medium text-navy">No visits recorded yet.</p>
          <p className="mt-1">
            The tracker is live on every public page. Visits appear here once someone opens the site in a browser that
            is not excluded (your signed-in visits and this browser&apos;s, if excluded, are never counted). Nothing on
            this page is sample data.
          </p>
        </div>
      )}

      {/* ---- Overview ---------------------------------------------------- */}
      <Section id="overview" title="Overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi
            label="Page views"
            value={formatNumber(kpis.pageviews)}
            delta={<Delta current={kpis.pageviews} previous={prevKpis?.pageviews ?? null} show={showDelta} />}
          />
          <Kpi
            label="Unique visitors"
            estimate
            value={formatNumber(kpis.visitors)}
            sub={range.days > 1 ? 'counted per day' : undefined}
            delta={<Delta current={kpis.visitors} previous={prevKpis?.visitors ?? null} show={showDelta} />}
          />
          <Kpi
            label="Sessions"
            value={formatNumber(kpis.sessions)}
            delta={<Delta current={kpis.sessions} previous={prevKpis?.sessions ?? null} show={showDelta} />}
          />
          <Kpi
            label="Avg. session duration"
            value={formatDuration(kpis.avgEngagedMs)}
            sub={
              kpis.timedSessions
                ? `visible time, ${kpis.timedSessions} of ${kpis.sessions} sessions timed`
                : 'no timing data yet'
            }
          />
          <Kpi
            label="Most popular page"
            value={kpis.topPage ? name(kpis.topPage.path) : '—'}
            sub={kpis.topPage ? plural(kpis.topPage.views, 'view') : undefined}
          />
          <Kpi
            label="Most clicked"
            value={kpis.topClick ? kpis.topClick.label : '—'}
            sub={kpis.topClick ? `${plural(kpis.topClick.clicks, 'click')} · ${plural(kpis.meaningfulClicks, 'key interaction')} in total` : undefined}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Page views, sessions and clicks are counts of recorded events. Visitors are estimated: a visitor is recognised
          only within one day (rotating anonymous hash), so someone returning on another day counts again, and people
          sharing a network and browser may count once. Session duration is the time pages were visible.
          {compare && !showDelta && ' No data in the previous period to compare with yet.'}
        </p>
        <div className="mt-5">
          <SeriesChart points={data.series} previous={data.prevSeries} previousLabel="Previous period" />
        </div>
      </Section>

      {/* ---- Origins ----------------------------------------------------- */}
      <Section
        id="origins"
        title="Where visitors come from"
        description="Click a row to filter the whole dashboard. Referrers are what browsers report — many visits arrive with none (typed address, apps, privacy settings) and count as Direct. Nothing here identifies a person or organisation."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Countries" note={countryShare === null ? undefined : `Location known for ${formatPercent(health.withCountry, health.pageviews)} of all page views (from Netlify's geolocation).`}>
            <SortableTable
              caption="Countries"
              columns={originColumns('Country')}
              rows={breakdownRows(data.countries, 'country', (k) => countryName(k), (k) => k ?? 'unknown', filters.country)}
              empty="No visits in this period."
            />
          </Panel>
          <Panel title="Referrers" note="The site that sent the visitor (or utm_source when there is no referrer).">
            <SortableTable
              caption="Referrers"
              columns={originColumns('Source')}
              rows={breakdownRows(data.referrers, 'referrer', (k) => k ?? 'None (direct)', (k) => k ?? 'none', filters.referrer)}
              empty="No visits in this period."
            />
          </Panel>
          <Panel title="Channels" note="Classified from the referrer: search engines, social networks, webmail, other sites, or none.">
            <SortableTable
              caption="Channels"
              columns={originColumns('Channel')}
              rows={breakdownRows(data.channels, 'channel', (k) => CHANNEL_LABELS[k ?? 'unknown'] ?? k ?? 'Unknown', (k) => k ?? 'unknown', filters.channel).filter((r) => (CHANNELS as readonly string[]).includes(r.id))}
              empty="No visits in this period."
            />
          </Panel>
          <Panel title="Devices" note="From screen and pointer type (or the browser's user agent).">
            <SortableTable
              caption="Devices"
              columns={originColumns('Device')}
              rows={breakdownRows(data.devices, 'device', (k) => (k ? k[0].toUpperCase() + k.slice(1) : 'Unknown'), (k) => k ?? 'unknown', filters.device).filter((r) => r.id !== 'unknown')}
              empty="No visits in this period."
            />
          </Panel>
          <Panel title="Landing pages" note="The first page of each session." className="lg:col-span-2">
            <SortableTable
              caption="Landing pages"
              columns={[
                { key: 'name', label: 'Page' },
                { key: 'sessions', label: 'Sessions started here', numeric: true, bar: true },
              ]}
              rows={data.landing.map((l) => ({
                id: l.path,
                href: href({ page: l.path }, '#origins'),
                cells: {
                  name: { display: name(l.path), sort: name(l.path), hint: l.path },
                  sessions: { display: formatNumber(l.sessions), sort: l.sessions },
                },
              }))}
              empty="No sessions in this period."
            />
          </Panel>
        </div>
      </Section>

      {/* ---- Portfolio interest ------------------------------------------ */}
      <Section
        id="interest"
        title="Portfolio interest"
        description="Research themes ranked by the sessions that viewed or clicked something belonging to them — paper and project pages by their category, plus clicks on research cards and theme links. The mapping lives in lib/analytics/config.ts; it says what pages drew attention, not who the visitors are."
      >
        <div className="rounded-2xl bg-white p-5 shadow-sm shadow-navy/5">
          {data.interest.every((t) => t.sessions === 0) ? (
            <Empty>No visits to research pages in this period yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {data.interest.map((theme) => (
                <li key={theme.id} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-navy">{theme.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className="block h-full rounded-full bg-steel" style={{ width: `${(theme.sessions / interestMax) * 100}%` }} />
                  </span>
                  <span className="w-48 text-right text-xs tabular-nums text-muted-foreground">
                    {plural(theme.sessions, 'session')} · {plural(theme.views, 'view')} · {plural(theme.clicks, 'click')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* ---- Attention & engagement -------------------------------------- */}
      <Section
        id="attention"
        title="Attention & engagement"
        description="An interaction is a click on a paper, project, research theme, download, contact detail, external link or call to action. Read to 75% counts only sessions on pages long enough to scroll."
      >
        <Panel title="Pages" note="Click a page to drill into it across the dashboard.">
          <SortableTable
            caption="Pages by attention"
            columns={[
              { key: 'name', label: 'Page' },
              { key: 'views', label: 'Views', numeric: true, bar: true },
              { key: 'visitors', label: 'Visitors', numeric: true },
              { key: 'time', label: 'Avg. time', numeric: true },
              { key: 'interaction', label: 'Interacted', numeric: true },
              { key: 'read', label: 'Read to 75%', numeric: true },
              { key: 'outbound', label: 'Outbound', numeric: true },
            ]}
            rows={pageRows}
            limit={12}
            empty="No page views in this period."
          />
        </Panel>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Views vs interactions" note="Sessions on each page (bar) and the share that interacted (darker part).">
            {data.pages.length === 0 ? (
              <Empty>No page views in this period.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {data.pages.slice(0, 10).map((p) => (
                  <li key={p.path} className="text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="truncate text-navy" title={p.path}>{name(p.path)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {p.meaningfulSessions} of {p.sessions}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary" aria-hidden>
                      <div className="relative h-full rounded-full bg-steel/30" style={{ width: `${(p.sessions / maxSessions) * 100}%` }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-steel"
                          style={{ width: `${p.sessions ? (p.meaningfulSessions / p.sessions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {viewedNoInteraction.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Viewed without any interaction (3+ sessions):{' '}
                {viewedNoInteraction.map((p) => name(p.path)).join(', ')}.
              </p>
            )}
          </Panel>
          <Panel title="How far visitors read" note="Share of scrolling sessions reaching each depth, per page.">
            {data.pages.filter((p) => p.scrollable).length === 0 ? (
              <Empty>No scroll data yet (short pages are not measured).</Empty>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 text-right font-medium">50%</th>
                    <th className="pb-2 text-right font-medium">75%</th>
                    <th className="pb-2 text-right font-medium">90%</th>
                    <th className="pb-2 text-right font-medium">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.filter((p) => p.scrollable).slice(0, 10).map((p) => (
                    <tr key={p.path} className="border-t border-border/70">
                      <td className="max-w-0 w-full truncate py-1.5 pr-3" title={p.path}>{name(p.path)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{formatPercent(p.scroll50, p.scrollable)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{formatPercent(p.scroll75, p.scrollable)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{formatPercent(p.scroll90, p.scrollable)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{p.scrollable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Panel>
          <Panel title="Research: most viewed pages">
            <SortableTable
              caption="Most viewed research pages"
              columns={[
                { key: 'name', label: 'Paper or project' },
                { key: 'views', label: 'Views', numeric: true, bar: true },
                { key: 'visitors', label: 'Visitors', numeric: true },
                { key: 'time', label: 'Avg. time', numeric: true },
              ]}
              rows={researchPageRows}
              empty="No paper or project pages viewed in this period."
            />
          </Panel>
          <Panel title="Research: most clicked" note="Paper and project cards, research themes, downloads.">
            <SortableTable
              caption="Most clicked research links"
              columns={[
                { key: 'name', label: 'Element' },
                { key: 'clicks', label: 'Clicks', numeric: true, bar: true },
                { key: 'sessions', label: 'Sessions', numeric: true },
              ]}
              rows={clickRows(data.researchClicks)}
              empty="No research clicks in this period."
            />
          </Panel>
          <Panel title="External destinations" note="Grouped by site.">
            <SortableTable
              caption="External destinations"
              columns={[
                { key: 'target', label: 'Destination' },
                { key: 'clicks', label: 'Clicks', numeric: true, bar: true },
                { key: 'sessions', label: 'Sessions', numeric: true },
              ]}
              rows={clickRows(data.outbound, false)}
              empty="No external links followed in this period."
            />
          </Panel>
          <Panel title="All clicked elements">
            <SortableTable
              caption="All clicked elements"
              columns={[
                { key: 'name', label: 'Element' },
                { key: 'kind', label: 'Kind' },
                { key: 'clicks', label: 'Clicks', numeric: true, bar: true },
              ]}
              rows={clickRows(data.allClicks)}
              empty="No clicks in this period."
            />
          </Panel>
        </div>
      </Section>

      {/* ---- Journeys ----------------------------------------------------- */}
      <Section
        id="journeys"
        title="Visitor journeys"
        description="How sessions move through the site. Sessions are pseudonymous (a random id per visit) and cannot be linked to a person or across days."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Common paths" note="The first three pages of each session.">
            {data.commonPaths.length === 0 ? (
              <Empty>No sessions in this period.</Empty>
            ) : (
              <ol className="space-y-2 text-sm">
                {data.commonPaths.map((path, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-navy">{path.steps.map(name).join(' → ')}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{plural(path.sessions, 'session')}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Exit pages" note="The last page viewed in each session.">
            <SortableTable
              caption="Exit pages"
              columns={[
                { key: 'name', label: 'Page' },
                { key: 'sessions', label: 'Sessions ended here', numeric: true, bar: true },
              ]}
              rows={data.exits.map((l) => ({
                id: l.path,
                cells: {
                  name: { display: name(l.path), sort: name(l.path), hint: l.path },
                  sessions: { display: formatNumber(l.sessions), sort: l.sessions },
                },
              }))}
              empty="No sessions in this period."
            />
          </Panel>
          <Panel title="What visitors do next" note="For the most viewed pages: the next page in the same session, or leaving the site." className="lg:col-span-2">
            {journeyPages.length === 0 ? (
              <Empty>No page-to-page movement recorded in this period.</Empty>
            ) : (
              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                {journeyPages.map((p) => {
                  const nexts = nextByPage.get(p.path)!
                  const total = nexts.reduce((sum, n) => sum + n.sessions, 0)
                  return (
                    <div key={p.path}>
                      <p className="text-sm font-medium text-navy">{name(p.path)}</p>
                      <ul className="mt-1.5 space-y-1">
                        {nexts.slice(0, 4).map((n) => (
                          <li key={n.next ?? 'exit'} className="flex items-center gap-2 text-xs">
                            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                              {formatPercent(n.sessions, total)}
                            </span>
                            <span className={n.next ? 'text-navy' : 'text-muted-foreground'}>
                              {n.next ? `→ ${name(n.next)}` : 'Left the site'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
          <Panel title="Recent sessions" note="Page views and clicks in order, with the time between steps." className="lg:col-span-2">
            {data.journeys.length === 0 ? (
              <Empty>No sessions in this period.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {data.journeys.map((j) => (
                  <li key={j.sessionId} className="py-3">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium text-navy">{formatDateTime(j.start)}</span>
                        <span className="text-muted-foreground">
                          {[
                            j.country ? countryName(j.country) : null,
                            j.device,
                            j.referrerHost ? `via ${j.referrerHost}` : CHANNEL_LABELS[j.channel ?? 'unknown'],
                            `${j.steps.filter((s) => s.type === 'pageview').length} pages`,
                            j.engagedMs ? formatDuration(j.engagedMs) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="min-w-0 basis-full truncate text-xs text-muted-foreground sm:basis-auto">
                          {j.steps.filter((s) => s.type === 'pageview').map((s) => name(s.path)).join(' → ')}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground" title="Pseudonymous session id">
                          {shortSession(j.sessionId)}
                        </span>
                      </summary>
                      <ol className="mt-3 space-y-1 border-l border-border pl-4">
                        {j.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-xs">
                            <time className="w-16 shrink-0 tabular-nums text-muted-foreground">{formatTime(step.createdAt)}</time>
                            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                              {i ? formatGap(new Date(step.createdAt).getTime() - new Date(j.steps[i - 1].createdAt).getTime()) : ''}
                            </span>
                            <span className={step.type === 'pageview' ? 'text-navy' : 'text-steel-700'}>
                              {describeEvent(step)}
                              {step.type === 'click' && step.target && (
                                <span className="text-muted-foreground"> → {step.target}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Section>

      {/* ---- Activity ------------------------------------------------------ */}
      <Section id="activity" title="Activity">
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel title="Live feed" note="Latest page views and clicks (all filters ignored)." className="lg:col-span-2">
            <LiveFeed
              initial={data.feed.map((e) => ({
                id: e.id,
                createdAt: new Date(e.createdAt).toISOString(),
                type: e.type,
                name: e.name,
                label: e.label,
                path: e.path,
                target: e.target,
                country: e.country,
                sessionId: shortSession(e.sessionId),
              }))}
            />
          </Panel>
          <Panel title="Event log" note={`${formatNumber(data.log.total)} events match the date range and filters.`} className="lg:col-span-3">
            <form action="/admin/analytics#activity" className="mb-3 flex flex-wrap items-end gap-2 text-xs">
              {hidden(['etype', 'dest'])}
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground">Event type</span>
                <select name="etype" defaultValue={eventType ?? ''} className="rounded-lg border border-border bg-white px-2 py-1">
                  <option value="">All</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground">Destination contains</span>
                <input name="dest" defaultValue={destination ?? ''} placeholder="e.g. linkedin" className="rounded-lg border border-border bg-white px-2 py-1" />
              </label>
              <button type="submit" className="rounded-full border border-border px-3 py-1 text-navy hover:bg-secondary">Filter</button>
              <span className="text-muted-foreground">Use the page selector above to filter by page.</span>
            </form>
            {data.log.rows.length === 0 ? (
              <Empty>No events match.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[36rem] text-xs">
                  <div className="grid grid-cols-[7.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_4.5rem] gap-2 border-b border-border pb-1.5 font-medium text-muted-foreground">
                    <span>Time</span>
                    <span>Event</span>
                    <span>Page · element</span>
                    <span>Destination</span>
                    <span>Country</span>
                    <span>Session</span>
                  </div>
                  {data.log.rows.map((e) => (
                    <details key={e.id} className="border-b border-border/60">
                      <summary className="grid cursor-pointer grid-cols-[7.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_4.5rem] gap-2 py-1.5 hover:bg-secondary/60">
                        <span className="tabular-nums text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                        <span className="truncate">{e.type === 'click' ? eventName(e.name) : EVENT_TYPE_LABELS[e.type]}</span>
                        <span className="truncate text-navy" title={e.path}>
                          {e.label ? `${e.label}` : name(e.path)}
                          {e.label && <span className="text-muted-foreground"> · {e.path}</span>}
                        </span>
                        <span className="truncate text-muted-foreground" title={e.target ?? undefined}>{e.target ?? (e.value !== null ? (e.type === 'scroll' ? `${e.value}%` : formatDuration(e.value)) : '—')}</span>
                        <span className="truncate">{e.country ?? '—'}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{shortSession(e.sessionId)}</span>
                      </summary>
                      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 bg-secondary/40 px-3 py-2">
                        <dt className="text-muted-foreground">Description</dt><dd>{describeEvent(e)}</dd>
                        <dt className="text-muted-foreground">Event id</dt><dd className="font-mono">{e.type}/{e.name} #{e.id}</dd>
                        <dt className="text-muted-foreground">Page</dt><dd>{name(e.path)} ({e.path})</dd>
                        {e.label && (<><dt className="text-muted-foreground">Element</dt><dd>{e.label}</dd></>)}
                        {e.target && (<><dt className="text-muted-foreground">Destination</dt><dd className="break-all">{e.target}</dd></>)}
                        {e.value !== null && (<><dt className="text-muted-foreground">Value</dt><dd>{e.type === 'scroll' ? `${e.value}% of the page` : formatDuration(e.value)}</dd></>)}
                        <dt className="text-muted-foreground">Session source</dt><dd>{CHANNEL_LABELS[e.channel ?? 'unknown']}{e.referrerHost ? ` · ${e.referrerHost}` : ''}</dd>
                        <dt className="text-muted-foreground">Country · device</dt><dd>{countryName(e.country)} · {e.device ?? 'unknown'}</dd>
                        <dt className="text-muted-foreground">Session</dt><dd className="font-mono">{e.sessionId}</dd>
                      </dl>
                    </details>
                  ))}
                </div>
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-3 flex items-center gap-3 text-xs">
                {logPage > 1 && <Link href={href({ p: String(logPage - 1) }, '#activity')} className="text-steel-700 hover:text-navy">← Newer</Link>}
                <span className="text-muted-foreground">Page {logPage} of {totalPages}</span>
                {logPage < totalPages && <Link href={href({ p: String(logPage + 1) }, '#activity')} className="text-steel-700 hover:text-navy">Older →</Link>}
              </div>
            )}
          </Panel>
        </div>
      </Section>

      {/* ---- Data & privacy ------------------------------------------------ */}
      <Section id="data" title="Data & privacy">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="What is recorded">
            <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
              <li>Page views, clicks on links and buttons (with a readable label and destination), scroll depth at 25/50/75/90%, and visible time on page.</li>
              <li>Country (from Netlify&apos;s geolocation), device type, referrer site and channel.</li>
              <li>A random session id and a visitor hash that changes daily; the salt behind it is deleted the next day.</li>
              <li>Never stored: IP addresses, full referrer URLs, query strings of external links, form contents, cookies or local storage on visitors&apos; devices.</li>
              <li>Not tracked: admin and login pages, signed-in admins, browsers with Do Not Track or Global Privacy Control, known bots.</li>
            </ul>
          </Panel>
          <Panel title="Data health">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Events stored</dt><dd>{formatNumber(health.total)}</dd>
              <dt className="text-muted-foreground">First / last</dt>
              <dd>{health.first ? `${formatDateTime(health.first)} – ${formatDateTime(health.last!)}` : '—'}</dd>
              <dt className="text-muted-foreground">With country</dt>
              <dd>{health.pageviews ? `${formatPercent(health.withCountry, health.pageviews)} of page views` : '—'}</dd>
              <dt className="text-muted-foreground">Geo header now</dt>
              <dd>
                {geoHere.country
                  ? `${geoHere.source} → ${countryName(geoHere.country)}`
                  : 'none on this request (expected locally; on Netlify, check after deploying)'}
              </dd>
              <dt className="text-muted-foreground">Retention</dt>
              <dd>{RETENTION_DAYS} days (auto-deleted){health.expired ? ` · ${health.expired} due for deletion` : ''}</dd>
            </dl>
          </Panel>
          <Panel title="Your own visits">
            <p className="text-xs leading-relaxed text-muted-foreground">
              While you are signed in, your visits are never counted. To also exclude this browser when signed out, set a
              small cookie (it only says “1”). Other browsers and devices need it set separately.
            </p>
            <form action={setExcludeThisBrowser} className="mt-3">
              <input type="hidden" name="exclude" value={excluded ? '0' : '1'} />
              <button type="submit" className="rounded-full bg-navy px-4 py-1.5 text-xs font-medium text-white hover:bg-navy-800">
                {excluded ? 'Count this browser again' : 'Exclude this browser'}
              </button>
              <span className="ml-3 text-xs text-muted-foreground">
                {excluded ? 'This browser is excluded.' : 'This browser is counted when signed out.'}
              </span>
            </form>
          </Panel>
          <Panel title="Delete data" className="lg:col-span-3">
            <div className="flex flex-wrap gap-6">
              <form action={purgeOldEvents} className="flex flex-wrap items-end gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Delete events older than (days)</span>
                  <input type="number" name="days" min={1} max={3650} defaultValue={90} required className="w-28 rounded-lg border border-border bg-white px-2 py-1" />
                </label>
                <button type="submit" className="rounded-full border border-border px-3 py-1 text-navy hover:bg-secondary">Delete old events</button>
              </form>
              <form action={deleteAllEvents} className="flex flex-wrap items-end gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Type DELETE to remove all analytics events</span>
                  <input name="confirm" autoComplete="off" className="w-40 rounded-lg border border-border bg-white px-2 py-1" />
                </label>
                <button type="submit" className="rounded-full border border-destructive/40 px-3 py-1 text-destructive hover:bg-destructive/10">Delete everything</button>
              </form>
            </div>
          </Panel>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Click names recorded: {Object.values(CLICK_NAMES).join(', ')}.
        </p>
      </Section>
    </main>
  )
}
