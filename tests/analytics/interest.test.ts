import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeFor } from '../../lib/analytics/queries'

test('research themes come from categories, then from paths and labels', () => {
  assert.equal(themeFor({ category: 'Commodity Research', text: '/papers/some-slug' }), 'commodities')
  assert.equal(themeFor({ category: 'macroeconomics', text: '' }), 'macro')
  assert.equal(themeFor({ text: '/papers?category=financial-markets Research focus: Financial Markets' }), 'markets')
  assert.equal(themeFor({ text: '/papers?category=geopolitical-risk' }), 'geopolitics')
  assert.equal(themeFor({ text: 'Research focus: Emerging Markets & Sovereign Risk' }), 'em')
  assert.equal(themeFor({ text: '/contact' }), null)
})
