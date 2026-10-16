import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'

// Integration test: stores events through the real ingestion code and checks
// that the dashboard's aggregates match them. Runs only with
// TEST_DATABASE_URL set to a disposable database that already has the
// schema (`npm run db:push`). Its rows use the reserved country code "ZZ"
// and are deleted afterwards.
const url = process.env.TEST_DATABASE_URL
const skip = url ? false : 'TEST_DATABASE_URL not set'

type Ingest = typeof import('../../lib/analytics/ingest')
type Queries = typeof import('../../lib/analytics/queries')
type Validate = typeof import('../../lib/analytics/validate')
let ingest: Ingest
let queries: Queries
let validate: Validate
let close: () => Promise<void>

const filters = { country: 'ZZ', referrer: null, channel: null, device: null, page: null }
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

async function send(ip: string, events: Parameters<Validate['cleanEvent']>[0][]) {
  const clean = events.map(validate.cleanEvent).filter((e) => e !== null)
  await ingest.storeEvents({ events: clean, ip, userAgent: UA, siteHost: 'example.test', country: 'ZZ', device: 'desktop' })
}

before(async () => {
  if (!url) return
  process.env.DATABASE_URL = url
  ingest = await import('../../lib/analytics/ingest')
  queries = await import('../../lib/analytics/queries')
  validate = await import('../../lib/analytics/validate')
  const { pool } = await import('../../lib/db')
  await pool.query(`DELETE FROM analytics_events WHERE country = 'ZZ'`)
  close = async () => {
    await pool.query(`DELETE FROM analytics_events WHERE country = 'ZZ'`)
    await pool.end()
  }
})

after(async () => {
  if (close) await close()
})

test('ingested events add up on the dashboard', { skip }, async () => {
  // Visitor A: arrives from LinkedIn, reads a paper, downloads the CV.
  await send('203.0.113.1', [
    { t: 'pageview', n: 'pageview', p: '/', r: 'https://www.linkedin.com/feed/' },
    { t: 'click', n: 'nav', p: '/', l: 'Papers', g: '/papers' },
  ])
  await send('203.0.113.1', [
    { t: 'pageview', n: 'pageview', p: '/papers' },
    { t: 'scroll', n: 'scroll_depth', p: '/papers', v: 50 },
    { t: 'scroll', n: 'scroll_depth', p: '/papers', v: 75 },
    { t: 'engagement', n: 'page_engagement', p: '/', v: 4000 },
  ])
  await send('203.0.113.1', [
    { t: 'pageview', n: 'pageview', p: '/cv' },
    { t: 'click', n: 'cv_download', p: '/cv', l: 'Download CV', g: '/api/files/cv.pdf' },
    { t: 'engagement', n: 'page_engagement', p: '/cv', v: 6000 },
  ])
  // Visitor B: direct visit to the home page only, then leaves.
  await send('203.0.113.2', [{ t: 'pageview', n: 'pageview', p: '/' }])
  // Rejected events never reach the database.
  await send('203.0.113.3', [{ t: 'pageview', n: 'pageview', p: '/admin' }])

  const from = new Date(Date.now() - 3_600_000)
  const to = new Date(Date.now() + 60_000)

  const kpis = await queries.getKpis(from, to, filters)
  assert.equal(kpis.pageviews, 4)
  assert.equal(kpis.visitors, 2)
  assert.equal(kpis.sessions, 2)
  assert.equal(kpis.clicks, 2)
  assert.equal(kpis.meaningfulClicks, 1) // nav clicks are not "key interactions"
  assert.equal(kpis.avgEngagedMs, 10_000) // one timed session: 4s + 6s
  assert.equal(kpis.timedSessions, 1)
  assert.deepEqual(kpis.topPage, { path: '/', views: 2 })

  const channels = await queries.getBreakdown('channel', from, to, filters)
  assert.deepEqual(
    channels.map((c) => [c.key, c.sessions, c.pageviews]).sort(),
    [['direct', 1, 1], ['social', 1, 3]],
  )
  // Referrer is copied from the landing page view onto the whole session.
  const referrers = await queries.getBreakdown('referrerHost', from, to, filters)
  assert.deepEqual(referrers.find((r) => r.key === 'linkedin.com')?.pageviews, 3)
  const social = await queries.getKpis(from, to, { ...filters, channel: 'social' })
  assert.equal(social.pageviews, 3)

  const landing = await queries.getEdgePages('landing', from, to, filters)
  assert.deepEqual(landing, [{ path: '/', sessions: 2 }])
  const exits = await queries.getEdgePages('exit', from, to, filters)
  assert.deepEqual(exits.sort((a, b) => a.path.localeCompare(b.path)), [
    { path: '/', sessions: 1 },
    { path: '/cv', sessions: 1 },
  ])

  const paths = await queries.getCommonPaths(from, to, filters)
  assert.deepEqual(paths.find((p) => p.steps.length === 3)?.steps, ['/', '/papers', '/cv'])

  const transitions = await queries.getTransitions(from, to, filters)
  assert.ok(transitions.some((t) => t.path === '/' && t.next === '/papers' && t.sessions === 1))
  assert.ok(transitions.some((t) => t.path === '/' && t.next === null && t.sessions === 1))

  const pages = await queries.getPages(from, to, filters)
  const papers = pages.find((p) => p.path === '/papers')!
  assert.deepEqual([papers.scrollable, papers.scroll50, papers.scroll75, papers.scroll90], [1, 1, 1, 0])
  const cv = pages.find((p) => p.path === '/cv')!
  assert.deepEqual([cv.meaningfulSessions, cv.avgEngagedMs], [1, 6000])

  const clicks = await queries.getClicks(from, to, filters, ['cv_download'])
  assert.deepEqual(clicks.map((c) => [c.label, c.clicks]), [['Download CV', 1]])

  const series = await queries.getTimeseries(
    { bucket: 'hour', days: 1 } as Parameters<Queries['getTimeseries']>[0],
    filters,
    from,
    to,
  )
  assert.equal(series.reduce((sum, p) => sum + p.pageviews, 0), 4)

  const journeys = await queries.getRecentJourneys(from, to, filters)
  const a = journeys.find((j) => j.steps.length === 5)!
  assert.deepEqual(a.steps.map((s) => s.type + ':' + s.path), [
    'pageview:/', 'click:/', 'pageview:/papers', 'pageview:/cv', 'click:/cv',
  ])

  const log = await queries.getEventLog(from, to, filters, { type: 'click', destination: 'cv.pdf', page: 1, pageSize: 10 })
  assert.equal(log.total, 1)

  // Nothing outside the window.
  const before = await queries.getKpis(new Date(Date.now() - 7_200_000), from, filters)
  assert.equal(before.pageviews, 0)
})

test('a visitor returning after the session gap starts a new session', { skip }, async () => {
  const { pool } = await import('../../lib/db')
  await send('203.0.113.9', [{ t: 'pageview', n: 'pageview', p: '/contact' }])
  await pool.query(
    `UPDATE analytics_events SET "createdAt" = "createdAt" - interval '45 minutes'
      WHERE country = 'ZZ' AND path = '/contact'`,
  )
  await send('203.0.113.9', [{ t: 'pageview', n: 'pageview', p: '/contact' }])
  const { rows } = await pool.query(
    `SELECT count(DISTINCT "sessionId") AS sessions, count(DISTINCT "visitorHash") AS visitors
       FROM analytics_events WHERE country = 'ZZ' AND path = '/contact'`,
  )
  assert.equal(Number(rows[0].sessions), 2)
  assert.equal(Number(rows[0].visitors), 1)
  // No raw IP address is stored anywhere in the row.
  const { rows: all } = await pool.query(`SELECT * FROM analytics_events WHERE country = 'ZZ'`)
  assert.ok(all.every((row) => !JSON.stringify(row).includes('203.0.113')))
})
