#!/usr/bin/env node
// Validates a project's output file against "portfolio-output/1" — the
// same rules the portfolio site applies before it stores an output
// (lib/project-output.ts in the website repository; JSON Schema in
// schema/portfolio-output-1.json). Zero dependencies, Node 18+.
//
//   node scripts/validate-output.mjs site/latest.json
//
// Exits 1 and lists every problem when the file isn't valid, so the
// workflow stops before publishing it.

import { readFileSync, statSync } from 'node:fs'

const file = process.argv[2] ?? 'site/latest.json'
const MAX_BYTES = 1024 * 1024
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/
const HTTPS = /^https:\/\/\S+$/

const errors = []
const fail = (path, message) => errors.push(`${path || 'file'}: ${message}`)

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)

function text(value, path, { min = 1, max, optional = false } = {}) {
  if (value === undefined && optional) return
  if (typeof value !== 'string') return fail(path, 'must be a string')
  const length = value.trim().length
  if (length < min) fail(path, min === 1 ? "can't be empty" : `must be at least ${min} characters`)
  if (max !== undefined && length > max) fail(path, `must be at most ${max} characters`)
}

function isoDate(value, path, optional = false) {
  if (value === undefined && optional) return
  if (typeof value !== 'string' || !ISO.test(value.trim())) {
    return fail(path, 'must be an ISO date (2026-09-23) or date-time with timezone (2026-09-23T06:00:00Z)')
  }
  if (Number.isNaN(Date.parse(value.trim()))) fail(path, 'is not a real date')
}

function list(value, path, max, each, { min = 0 } = {}) {
  if (value === undefined) return
  if (!Array.isArray(value)) return fail(path, 'must be an array')
  if (value.length < min) fail(path, `needs at least ${min} item${min > 1 ? 's' : ''}`)
  if (value.length > max) fail(path, `has ${value.length} items (max ${max})`)
  value.slice(0, max).forEach((item, i) => each(item, `${path}[${i}]`))
}

function headline(item, path) {
  if (!isObject(item)) return fail(path, 'must be an object')
  text(item.id, `${path}.id`, { max: 60 })
  text(item.label, `${path}.label`, { max: 120 })
  if (typeof item.value === 'string') text(item.value, `${path}.value`, { max: 60 })
  else if (!isNumber(item.value)) fail(`${path}.value`, 'must be a finite number or a short text')
  text(item.unit, `${path}.unit`, { min: 0, max: 30, optional: true })
  if (item.change !== undefined && !isNumber(item.change)) fail(`${path}.change`, 'must be a finite number')
  isoDate(item.asOf, `${path}.asOf`, true)
  text(item.note, `${path}.note`, { min: 0, max: 200, optional: true })
}

function point(p, path) {
  if (!Array.isArray(p) || (p.length !== 2 && p.length !== 4)) {
    return fail(path, 'must be [x, y] or [x, y, lower, upper]')
  }
  const [x, y, lo, hi] = p
  if (typeof x === 'string') isoDate(x, `${path}[0]`)
  else if (!isNumber(x)) fail(`${path}[0]`, 'x must be an ISO date or a finite number')
  if (y !== null && !isNumber(y)) fail(`${path}[1]`, 'y must be a finite number or null')
  if (p.length === 4) {
    if (!isNumber(lo)) fail(`${path}[2]`, 'lower bound must be a finite number')
    if (!isNumber(hi)) fail(`${path}[3]`, 'upper bound must be a finite number')
  }
}

function series(item, path) {
  if (!isObject(item)) return fail(path, 'must be an object')
  text(item.id, `${path}.id`, { max: 60 })
  text(item.label, `${path}.label`, { max: 120 })
  text(item.unit, `${path}.unit`, { min: 0, max: 30, optional: true })
  if (item.points === undefined) return fail(`${path}.points`, 'is required')
  list(item.points, `${path}.points`, 5000, point, { min: 1 })
}

function download(item, path) {
  if (!isObject(item)) return fail(path, 'must be an object')
  text(item.label, `${path}.label`, { max: 120 })
  if (typeof item.url !== 'string' || !HTTPS.test(item.url.trim()) || item.url.trim().length > 1000) {
    fail(`${path}.url`, 'must be an https:// URL')
  }
}

let raw
try {
  if (statSync(file).size > MAX_BYTES) {
    console.error(`✗ ${file} is larger than 1 MB — publish big datasets as downloads instead.`)
    process.exit(1)
  }
  raw = readFileSync(file, 'utf8')
} catch (error) {
  console.error(`✗ Couldn't read ${file}: ${error.message}`)
  process.exit(1)
}

let data
try {
  data = JSON.parse(raw)
} catch (error) {
  console.error(`✗ ${file} isn't valid JSON: ${error.message}`)
  process.exit(1)
}

if (!isObject(data)) {
  fail('', 'must be a JSON object')
} else {
  if (data.schema !== 'portfolio-output/1') fail('schema', 'must be "portfolio-output/1"')
  isoDate(data.updatedAt, 'updatedAt')
  if (data.status !== undefined && !['ok', 'degraded', 'error'].includes(data.status)) {
    fail('status', 'must be "ok", "degraded" or "error"')
  }
  list(data.headline, 'headline', 12, headline)
  list(data.series, 'series', 20, series)
  text(data.notes, 'notes', { min: 0, max: 2000, optional: true })
  list(data.downloads, 'downloads', 20, download)
}

if (errors.length > 0) {
  console.error(`✗ ${file} is not a valid portfolio-output/1 file:`)
  for (const error of errors.slice(0, 50)) console.error(`  - ${error}`)
  if (errors.length > 50) console.error(`  … and ${errors.length - 50} more`)
  process.exit(1)
}

const counts = [
  `${data.headline?.length ?? 0} headline figure(s)`,
  `${data.series?.length ?? 0} series`,
  `${data.downloads?.length ?? 0} download(s)`,
]
console.log(`✓ ${file} is valid portfolio-output/1 (updated ${data.updatedAt}; ${counts.join(', ')})`)
