import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyLink, normalizeTarget } from '../../lib/analytics/classify-link'

const origin = 'https://toribioiriarte.com'
const click = (href: string, extra: Partial<Parameters<typeof classifyLink>[0]> = {}) =>
  classifyLink({ href, origin, pagePath: '/', ...extra })

test('links get stable names and readable labels', () => {
  assert.deepEqual(click('https://www.linkedin.com/in/x/?trk=1', { text: 'LinkedIn' }), {
    name: 'outbound',
    label: 'Visit LinkedIn',
    target: 'https://www.linkedin.com/in/x',
  })
  assert.equal(click('https://github.com/iriartet84/website')?.label, 'Visit GitHub')
  assert.equal(click('https://wa.me/123')?.name, 'whatsapp')
  assert.equal(click('mailto:me@example.com')?.name, 'contact_email')
  assert.equal(click('mailto:me@example.com')?.target, 'mailto:')
  assert.equal(click('tel:+33123')?.name, 'contact_phone')
  assert.deepEqual(click('/papers/oil-shocks', { text: 'Oil shocks and inflation' }), {
    name: 'paper_open',
    label: 'Oil shocks and inflation',
    target: '/papers/oil-shocks',
  })
  assert.equal(click('/projects/fx')?.name, 'project_open')
  assert.equal(click('/papers?category=commodity-research&x=1')?.target, '/papers?category=commodity-research')
  assert.equal(click('/papers?category=commodity-research')?.name, 'research_theme_open')
  assert.equal(click('/cv', { text: 'CV' })?.name, 'nav')
  assert.equal(click('/api/files/abc.pdf', { pagePath: '/cv' })?.name, 'cv_download')
  assert.equal(click('/api/files/abc.pdf', { pagePath: '/papers/x', text: 'Download PDF' })?.name, 'file_download')
  assert.equal(click('javascript:void(0)'), null)
})

test('explicit data-track attributes win, unknown names are ignored', () => {
  assert.deepEqual(click('/projects', { trackName: 'cta', trackLabel: 'Hero: View projects', text: 'View projects' }), {
    name: 'cta',
    label: 'Hero: View projects',
    target: '/projects',
  })
  assert.equal(click('/projects', { trackName: 'bogus' })?.name, 'nav')
  assert.equal(click('https://www.linkedin.com/x', { trackLabel: 'LinkedIn (CV header)' })?.label, 'LinkedIn (CV header)')
})

test('normalizeTarget strips query strings except ?category', () => {
  assert.equal(normalizeTarget('https://example.com/a/?q=1#h', origin), 'https://example.com/a')
  assert.equal(normalizeTarget('/papers?category=macro&utm=1', origin), '/papers?category=macro')
  assert.equal(normalizeTarget('ftp://example.com', origin), null)
})
