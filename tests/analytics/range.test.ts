import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, dashboardHref, localDay, parseFilters, parseRange, startOfDay } from '../../lib/analytics/range'

const TZ = 'Europe/Paris'

test('local midnight respects daylight saving time', () => {
  assert.equal(startOfDay('2026-01-15', TZ).toISOString(), '2026-01-14T23:00:00.000Z') // CET, UTC+1
  assert.equal(startOfDay('2026-07-15', TZ).toISOString(), '2026-07-14T22:00:00.000Z') // CEST, UTC+2
  assert.equal(startOfDay('2026-03-29', TZ).toISOString(), '2026-03-28T23:00:00.000Z') // DST starts that day
  assert.equal(startOfDay('2026-10-25', TZ).toISOString(), '2026-10-24T22:00:00.000Z') // DST ends that day
  assert.equal(localDay(new Date('2026-07-14T22:30:00Z'), TZ), '2026-07-15')
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
})

test('preset ranges end tomorrow at local midnight and compare to the same length before', () => {
  const now = new Date('2026-10-16T10:00:00Z')
  const week = parseRange({}, now, TZ)
  assert.equal(week.key, '7d')
  assert.equal(week.fromDay, '2026-10-10')
  assert.equal(week.toDay, '2026-10-16')
  assert.equal(week.days, 7)
  assert.equal(week.to.toISOString(), '2026-10-16T22:00:00.000Z')
  assert.equal(week.prevTo.getTime(), week.from.getTime())
  assert.equal(week.prevFrom.toISOString(), startOfDay('2026-10-03', TZ).toISOString())
  assert.equal(week.bucket, 'day')

  const today = parseRange({ range: 'today' }, now, TZ)
  assert.equal(today.days, 1)
  assert.equal(today.bucket, 'hour')
  assert.equal(today.prevFrom.toISOString(), startOfDay('2026-10-15', TZ).toISOString())

  assert.equal(parseRange({ range: '30d' }, now, TZ).fromDay, '2026-09-17')
})

test('custom ranges are validated, ordered and clamped', () => {
  const now = new Date('2026-10-16T10:00:00Z')
  const custom = parseRange({ range: 'custom', from: '2026-10-05', to: '2026-09-28' }, now, TZ)
  assert.deepEqual([custom.fromDay, custom.toDay, custom.days], ['2026-09-28', '2026-10-05', 8])
  // Future end dates stop at today.
  assert.equal(parseRange({ range: 'custom', from: '2026-10-10', to: '2027-01-01' }, now, TZ).toDay, '2026-10-16')
  // Invalid dates fall back to the default range.
  assert.equal(parseRange({ range: 'custom', from: '2026-02-30', to: 'x' }, now, TZ).key, '7d')
  // Very long ranges are capped at 400 days.
  assert.equal(parseRange({ range: 'custom', from: '2020-01-01', to: '2026-10-16' }, now, TZ).days, 400)
})

test('filters accept only known values', () => {
  assert.deepEqual(parseFilters({ country: 'fr', channel: 'social', device: 'mobile', referrer: 'LinkedIn.com', page: '/cv' }), {
    country: 'FR',
    channel: 'social',
    device: 'mobile',
    referrer: 'linkedin.com',
    page: '/cv',
  })
  assert.deepEqual(parseFilters({ country: 'France', channel: 'ads', device: 'tv', referrer: "x' OR 1=1", page: '/admin' }), {
    country: null,
    channel: null,
    device: null,
    referrer: null,
    page: null,
  })
  assert.equal(parseFilters({ country: 'unknown' }).country, 'unknown')
})

test('dashboard links keep other parameters and reset paging', () => {
  assert.equal(
    dashboardHref({ range: '30d', p: '3', country: 'FR' }, { channel: 'search', country: null }, '#origins'),
    '/admin/analytics?range=30d&channel=search#origins',
  )
})
