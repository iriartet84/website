'use client'

import { useId, useMemo, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

// Visitors / page views over the selected range, with an optional previous-
// period line for comparison. One y-axis, hairline grid, hover crosshair
// and tooltip; the numbers are also in the table view below the chart.

type Point = { bucket: string; pageviews: number; visitors: number }
type Metric = 'visitors' | 'pageviews'

const METRICS: { key: Metric; label: string }[] = [
  { key: 'visitors', label: 'Visitors (est.)' },
  { key: 'pageviews', label: 'Page views' },
]

const W = 720
const H = 220
const PAD = { top: 12, right: 12, bottom: 26, left: 40 }

function niceMax(value: number) {
  if (value <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(value))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= value) return m * step
  return 10 * step
}

function bucketLabel(bucket: string, hourly: boolean, long = false) {
  if (hourly) return `${bucket.slice(11, 13)}:00`
  const date = new Date(`${bucket}T12:00:00Z`)
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(long ? { weekday: 'short' } : {}),
  })
}

export function SeriesChart({
  points,
  previous,
  previousLabel,
}: {
  points: Point[]
  previous: Point[] | null
  previousLabel: string
}) {
  const [metric, setMetric] = useState<Metric>('visitors')
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const titleId = useId()
  const hourly = points[0]?.bucket.includes('T') ?? false

  const values = points.map((p) => p[metric])
  const prevValues = previous?.map((p) => p[metric]) ?? null
  const max = niceMax(Math.max(1, ...values, ...(prevValues ?? [])))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  const line = (series: number[]) => series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = `${line(values)}L${x(values.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const total = values.reduce((a, b) => a + b, 0)

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const i = Math.round(ratio * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  const summary = useMemo(
    () => `${METRICS.find((m) => m.key === metric)!.label}: ${total} in total over ${points.length} ${hourly ? 'hours' : 'days'}`,
    [metric, total, points.length, hourly],
  )

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm shadow-navy/5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id={titleId} className="font-medium text-navy">
          {hourly ? 'By hour' : 'By day'}
        </h3>
        <div role="group" aria-label="Metric" className="flex rounded-full bg-secondary p-0.5 text-xs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={cn(
                'rounded-full px-3 py-1 transition-colors',
                metric === m.key ? 'bg-white font-medium text-navy shadow-sm' : 'text-muted-foreground hover:text-navy',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded bg-steel" /> Selected period
          </span>
          {prevValues && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded bg-slate-300" /> {previousLabel}
            </span>
          )}
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Hide table' : 'Show table'}
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={titleId} aria-describedby={`${titleId}-d`}>
          <desc id={`${titleId}-d`}>{summary}</desc>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                {Number.isInteger(t) ? t.toLocaleString('en-GB') : t.toFixed(1)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={p.bucket} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {bucketLabel(p.bucket, hourly)}
              </text>
            ) : null,
          )}
          {prevValues && (
            <path d={line(prevValues)} fill="none" stroke="#cbd5e1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          <path d={area} fill="var(--steel)" opacity={0.1} />
          <path d={line(values)} fill="none" stroke="var(--steel)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(values[hover])} r={4.5} fill="var(--steel)" stroke="white" strokeWidth={2} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <div className="font-medium">{bucketLabel(points[hover].bucket, hourly, true)}</div>
            <div>
              {METRICS.find((m) => m.key === metric)!.label}: {values[hover].toLocaleString('en-GB')}
            </div>
            {prevValues && prevValues[hover] !== undefined && (
              <div className="text-white/70">
                {previousLabel}: {prevValues[hover].toLocaleString('en-GB')}
              </div>
            )}
          </div>
        )}
      </div>

      {showTable && (
        <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">{hourly ? 'Hour' : 'Day'}</th>
                <th className="px-3 py-1.5 text-right font-medium">Visitors (est.)</th>
                <th className="px-3 py-1.5 text-right font-medium">Page views</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.bucket} className="border-t border-border">
                  <td className="px-3 py-1.5">{bucketLabel(p.bucket, hourly, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.visitors}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.pageviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
