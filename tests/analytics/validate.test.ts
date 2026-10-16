import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyReferrer,
  cleanEvent,
  cleanTarget,
  countryFromHeaders,
  deviceFromUserAgent,
  isBot,
  isTrackablePath,
  optedOut,
  payloadSchema,
} from '../../lib/analytics/validate'

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

test('only public pages are trackable', () => {
  for (const ok of ['/', '/papers', '/papers/oil-shocks-2024', '/projects', '/projects/fx-dashboard', '/cv', '/contact']) {
    assert.ok(isTrackablePath(ok), ok)
  }
  for (const bad of ['/admin', '/admin/analytics', '/login', '/api/analytics', '/papers/../admin', '/papers/A', '/cv/x', '', 'papers', '/papers/' + 'a'.repeat(130)]) {
    assert.ok(!isTrackablePath(bad), bad)
  }
})

test('payload schema rejects unknown fields and oversized batches', () => {
  assert.ok(payloadSchema.safeParse({ e: [{ t: 'pageview', n: 'pageview', p: '/' }] }).success)
  assert.ok(!payloadSchema.safeParse({ e: [] }).success)
  assert.ok(!payloadSchema.safeParse({ e: [{ t: 'pageview', n: 'pageview', p: '/', password: 'x' }] }).success)
  assert.ok(!payloadSchema.safeParse({ e: [{ t: 'hack', n: 'pageview', p: '/' }] }).success)
  assert.ok(!payloadSchema.safeParse({ d: 'fridge', e: [{ t: 'pageview', n: 'pageview', p: '/' }] }).success)
  const many = Array.from({ length: 21 }, () => ({ t: 'pageview', n: 'pageview', p: '/' }))
  assert.ok(!payloadSchema.safeParse({ e: many }).success)
})

test('events are checked against the allowlist', () => {
  assert.equal(cleanEvent({ t: 'click', n: 'made_up', p: '/' }), null)
  assert.equal(cleanEvent({ t: 'pageview', n: 'pageview', p: '/admin' }), null)
  assert.equal(cleanEvent({ t: 'scroll', n: 'scroll_depth', p: '/', v: 33 }), null)
  assert.equal(cleanEvent({ t: 'engagement', n: 'page_engagement', p: '/', v: -1 }), null)
  assert.equal(cleanEvent({ t: 'engagement', n: 'page_engagement', p: '/', v: 31 * 60 * 1000 }), null)
  assert.equal(cleanEvent({ t: 'pageview', n: 'pageview', p: '/', v: 5 }), null)
  assert.equal(cleanEvent({ t: 'click', n: 'outbound', p: '/', g: 'javascript:alert(1)' }), null)

  const scroll = cleanEvent({ t: 'scroll', n: 'scroll_depth', p: '/papers', v: 75 })
  assert.equal(scroll?.value, 75)

  const click = cleanEvent({ t: 'click', n: 'cv_download', p: '/cv', l: '  Download\n\tCV  ', g: '/api/files/cv.pdf' })
  assert.deepEqual(
    { label: click?.label, target: click?.target, referrer: click?.referrer },
    { label: 'Download CV', target: '/api/files/cv.pdf', referrer: null },
  )
  // A click without a label gets the event's readable name.
  assert.equal(cleanEvent({ t: 'click', n: 'whatsapp', p: '/' })?.label, 'WhatsApp link')
  // Referrers are kept on page views only.
  assert.equal(cleanEvent({ t: 'pageview', n: 'pageview', p: '/', r: 'https://www.google.com/' })?.referrer, 'https://www.google.com/')
})

test('targets lose query strings, fragments and credentials', () => {
  assert.equal(cleanTarget('https://www.linkedin.com/in/someone/?trk=abc#x'), 'https://www.linkedin.com/in/someone')
  assert.equal(cleanTarget('https://user:pw@example.com/a'), null)
  assert.equal(cleanTarget('/papers?category=commodity-research'), '/papers?category=commodity-research')
  assert.equal(cleanTarget('/papers?token=secret'), '/papers')
  assert.equal(cleanTarget('mailto:'), 'mailto:')
  assert.equal(cleanTarget('mailto:someone@example.com'), null)
  assert.equal(cleanTarget('/<script>'), null)
})

test('referrers are classified into channels', () => {
  const site = 'toribioiriarte.com'
  assert.deepEqual(classifyReferrer(null, site), { referrerHost: null, channel: 'direct' })
  assert.deepEqual(classifyReferrer('https://www.google.co.uk/', site), { referrerHost: 'google.co.uk', channel: 'search' })
  assert.deepEqual(classifyReferrer('https://www.linkedin.com/', site), { referrerHost: 'linkedin.com', channel: 'social' })
  assert.deepEqual(classifyReferrer('https://mail.google.com/', site), { referrerHost: 'mail.google.com', channel: 'email' })
  assert.deepEqual(classifyReferrer('https://www.bse.eu/people', site), { referrerHost: 'bse.eu', channel: 'referral' })
  assert.deepEqual(classifyReferrer('https://toribioiriarte.com/cv', site), { referrerHost: null, channel: 'direct' })
  assert.deepEqual(classifyReferrer('not a url', site), { referrerHost: null, channel: 'unknown' })
  assert.deepEqual(classifyReferrer(null, site, 'linkedin'), { referrerHost: 'utm:linkedin', channel: 'social' })
})

test('country comes only from Netlify headers', () => {
  const geo = Buffer.from(JSON.stringify({ city: 'Paris', country: { code: 'FR', name: 'France' } })).toString('base64')
  const from = (headers: Record<string, string>) => countryFromHeaders((n) => headers[n] ?? null)
  assert.deepEqual(from({ 'x-nf-geo': geo }), { country: 'FR', source: 'x-nf-geo' })
  assert.deepEqual(from({ 'x-nf-geo': JSON.stringify({ country: { code: 'es' } }) }), { country: 'ES', source: 'x-nf-geo' })
  assert.deepEqual(from({ 'x-country': 'AR' }), { country: 'AR', source: 'x-country' })
  assert.deepEqual(from({ 'x-country': 'France' }), { country: null, source: null })
  assert.deepEqual(from({}), { country: null, source: null })
})

test('bots, devices and privacy signals', () => {
  assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'))
  assert.ok(isBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36'))
  assert.ok(isBot('curl/8.4.0'))
  assert.ok(isBot(null))
  assert.ok(!isBot(CHROME))
  assert.equal(deviceFromUserAgent(CHROME), 'desktop')
  assert.equal(deviceFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'), 'mobile')
  assert.equal(deviceFromUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Safari/537.36'), 'tablet')
  assert.ok(optedOut((n) => (n === 'sec-gpc' ? '1' : null)))
  assert.ok(optedOut((n) => (n === 'dnt' ? '1' : null)))
  assert.ok(!optedOut(() => null))
})
