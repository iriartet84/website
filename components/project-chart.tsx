'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { OutputSeries } from '@/lib/project-output'

// A chart drawn from a project's output series. One y-axis, at most four
// series in fixed palette order, 2px lines, rounded bar ends, hairline grid,
// a crosshair tooltip (pointer and arrow keys), a legend for two or more
// series, and a table view of the same numbers.

// Validated categorical palette (brand steel first). Series take these in
// order; text never uses them.
export const CHART_COLORS = ['#3a6aa7', '#eb6834', '#1baf7a', '#eda100'] as const
const GRID = '#dde2e8'
const AXIS_TEXT = '#535e6f'
const INK = '#0e1b2d'

type Point = { x: number; y: number | null; lo?: number; hi?: number }
type Prepared = { id: string; label: string; unit?: string; color: string; points: Point[]; byX: Map<number, Point> }

const dayMs = 86_400_000

function niceStep(span: number, count: number) {
  const raw = span / Math.max(count, 1)
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  const scaled = raw / power
  const nice = scaled < 1.5 ? 1 : scaled < 3 ? 2 : scaled < 7 ? 5 : 10
  return nice * power
}

function niceTicks(min: number, max: number, count = 5) {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    min -= pad
    max += pad
  }
  const step = niceStep(max - min, count)
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)))
  return { ticks, min: start, max: end, step }
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Calendar-aligned ticks for a time axis, at most ~6.
function timeTicks(min: number, max: number) {
  const spanDays = (max - min) / dayMs
  const start = new Date(min)
  const ticks: { value: number; label: string }[] = []
  if (spanDays > 365 * 2) {
    const years = spanDays / 365
    const every = [1, 2, 5, 10, 20, 50].find((n) => years / n <= 6) ?? 100
    let year = Math.ceil(start.getUTCFullYear() / every) * every
    for (; Date.UTC(year, 0, 1) <= max; year += every) {
      const value = Date.UTC(year, 0, 1)
      if (value >= min) ticks.push({ value, label: String(year) })
    }
  } else if (spanDays > 45) {
    const months = spanDays / 30.4
    const every = [1, 2, 3, 6].find((n) => months / n <= 6) ?? 12
    let m = start.getUTCFullYear() * 12 + start.getUTCMonth()
    m = Math.ceil(m / every) * every
    for (; ; m += every) {
      const year = Math.floor(m / 12)
      const month = m % 12
      const value = Date.UTC(year, month, 1)
      if (value > max) break
      if (value >= min) ticks.push({ value, label: month === 0 || ticks.length === 0 ? `${monthNames[month]} ${year}` : monthNames[month] })
    }
  } else {
    const every = [1, 2, 7, 14].find((n) => spanDays / n <= 6) ?? 30
    let value = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    for (; value <= max; value += every * dayMs) {
      if (value >= min) {
        const d = new Date(value)
        ticks.push({ value, label: `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}` })
      }
    }
  }
  return ticks
}

function formatNumber(value: number, step?: number) {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString('en-GB', { maximumFractionDigits: 1 })}bn`
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString('en-GB', { maximumFractionDigits: 1 })}m`
  const digits = step !== undefined ? Math.max(0, Math.min(4, -Math.floor(Math.log10(step)))) : abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  return value.toLocaleString('en-GB', { minimumFractionDigits: step !== undefined ? digits : 0, maximumFractionDigits: digits })
}

function formatX(value: number, isTime: boolean, withDay: boolean) {
  if (!isTime) return formatNumber(value)
  const d = new Date(value)
  return withDay
    ? `${d.getUTCDate()} ${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function prepare(series: OutputSeries[]) {
  const isTime = series.some((s) => s.points.some((p) => typeof p[0] === 'string'))
  const prepared: Prepared[] = series.slice(0, CHART_COLORS.length).map((s, i) => ({
    id: s.id,
    label: s.label,
    unit: s.unit,
    color: CHART_COLORS[i],
    points: s.points
      .map((p) => ({
        x: typeof p[0] === 'string' ? Date.parse(p[0]) : p[0],
        y: p[1],
        lo: p.length === 4 ? p[2] : undefined,
        hi: p.length === 4 ? p[3] : undefined,
      }))
      .filter((p) => Number.isFinite(p.x))
      .sort((a, b) => a.x - b.x),
    byX: new Map(),
  }))
  for (const s of prepared) for (const p of s.points) s.byX.set(p.x, p)
  // Show the day in labels when any two points are less than ~28 days apart.
  let withDay = false
  for (const s of prepared) {
    for (let i = 1; i < s.points.length; i++) {
      if (s.points[i].x - s.points[i - 1].x < 28 * dayMs) withDay = true
    }
  }
  const xs = Array.from(new Set(prepared.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b)
  return { prepared, isTime, withDay, xs }
}

function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

// A bar with its data end rounded (4px) and its baseline end square.
function barPath(x: number, width: number, y0: number, y1: number) {
  const r = Math.min(4, width / 2, Math.abs(y1 - y0))
  if (y1 <= y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + width - r} Q${x + width},${y1} ${x + width},${y1 + r} V${y0} Z`
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + width - r} Q${x + width},${y1} ${x + width},${y1 - r} V${y0} Z`
}

export function ProjectChart({
  series,
  kind = 'line',
  title,
  className,
}: {
  series: OutputSeries[]
  kind?: 'line' | 'bar'
  title: string
  className?: string
}) {
  const { prepared, isTime, withDay, xs } = useMemo(() => prepare(series), [series])
  const [containerRef, width] = useWidth<HTMLDivElement>(720)
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  const narrow = width < 520
  const height = narrow ? 240 : 320
  const units = Array.from(new Set(prepared.map((s) => s.unit).filter(Boolean)))
  const sharedUnit = units.length === 1 ? units[0] : undefined

  const yValues = prepared.flatMap((s) =>
    s.points.flatMap((p) => [p.y, p.lo, p.hi].filter((v): v is number => typeof v === 'number')),
  )
  if (kind === 'bar') yValues.push(0)
  const y = niceTicks(Math.min(...yValues), Math.max(...yValues), narrow ? 4 : 5)
  const yLabels = y.ticks.map((t) => formatNumber(t, y.step))

  // Direct labels at the line ends when there's room.
  const directLabels = kind === 'line' && prepared.length >= 2 && !narrow
  const endLabel = (s: Prepared) => (s.label.length > 18 ? `${s.label.slice(0, 17)}…` : s.label)
  const margin = {
    top: sharedUnit ? 22 : 10,
    right: directLabels ? Math.min(150, 16 + Math.max(...prepared.map((s) => endLabel(s).length)) * 6.6) : 12,
    bottom: 28,
    left: 12 + Math.max(...yLabels.map((l) => l.length)) * 6.8,
  }
  const plotW = Math.max(40, width - margin.left - margin.right)
  const plotH = height - margin.top - margin.bottom

  const xMin = xs[0]
  const xMax = xs[xs.length - 1]
  const band = kind === 'bar' ? plotW / Math.max(xs.length, 1) : 0
  const xScale = (value: number) => {
    if (kind === 'bar') return margin.left + (xs.indexOf(value) + 0.5) * band
    return xMax === xMin ? margin.left + plotW / 2 : margin.left + ((value - xMin) / (xMax - xMin)) * plotW
  }
  const yScale = (value: number) => margin.top + plotH - ((value - y.min) / (y.max - y.min)) * plotH

  const xTicks = isTime
    ? timeTicks(xMin, xMax)
    : niceTicks(xMin, xMax, narrow ? 4 : 6).ticks.filter((t) => t >= xMin && t <= xMax).map((value) => ({ value, label: formatNumber(value) }))
  // Bar charts label categories, thinned to fit.
  const barTickEvery = Math.max(1, Math.ceil(xs.length / (narrow ? 4 : 8)))

  // Keeps the first and last x labels inside the chart.
  function xLabel(x: number, label: string, key: string | number) {
    const half = (label.length * 6.2) / 2
    const anchor = x - half < 0 ? 'start' : x + half > width ? 'end' : 'middle'
    const at = anchor === 'start' ? Math.max(0, x - 4) : anchor === 'end' ? Math.min(width, x + 4) : x
    return (
      <text key={key} x={at} y={height - 8} textAnchor={anchor} fontSize={11} fill={AXIS_TEXT}>
        {label}
      </text>
    )
  }

  function linePath(points: Point[]) {
    let d = ''
    let pen = false
    for (const p of points) {
      if (p.y === null) {
        pen = false
        continue
      }
      d += `${pen ? 'L' : 'M'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`
      pen = true
    }
    return d
  }

  function bandPath(points: Point[]) {
    const withBand = points.filter((p) => p.lo !== undefined && p.hi !== undefined)
    if (withBand.length < 2) return ''
    const upper = withBand.map((p) => `${xScale(p.x).toFixed(1)},${yScale(p.hi!).toFixed(1)}`)
    const lower = withBand
      .slice()
      .reverse()
      .map((p) => `${xScale(p.x).toFixed(1)},${yScale(p.lo!).toFixed(1)}`)
    return `M${upper.join('L')}L${lower.join('L')}Z`
  }

  function nearestIndex(px: number) {
    if (kind === 'bar') return Math.max(0, Math.min(xs.length - 1, Math.floor((px - margin.left) / band)))
    let best = 0
    let bestDist = Infinity
    xs.forEach((x, i) => {
      const dist = Math.abs(xScale(x) - px)
      if (dist < bestDist) {
        best = i
        bestDist = dist
      }
    })
    return best
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * width
    if (px < margin.left - 8 || px > margin.left + plotW + 8) return setActive(null)
    setActive(nearestIndex(px))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) => Math.max(0, Math.min(xs.length - 1, (current ?? (step > 0 ? -1 : xs.length)) + step)))
    } else if (event.key === 'Home') {
      setActive(0)
    } else if (event.key === 'End') {
      setActive(xs.length - 1)
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const activeX = active !== null ? xs[active] : null
  const activeValues =
    activeX !== null
      ? prepared.map((s) => ({ series: s, point: s.byX.get(activeX) }))
      : []

  // Direct-label positions: last value of each series, nudged apart.
  const labels = directLabels
    ? prepared
        .map((s) => {
          const last = [...s.points].reverse().find((p) => p.y !== null)
          return last ? { s, y: yScale(last.y!), x: xScale(last.x) } : null
        })
        .filter((v): v is { s: Prepared; y: number; x: number } => v !== null)
        .sort((a, b) => a.y - b.y)
    : []
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14
  }

  const tooltipLeft = activeX !== null ? xScale(activeX) : 0
  const flip = tooltipLeft > width * 0.6

  if (xs.length === 0) return null

  return (
    <figure className={cn('not-prose', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {prepared.length >= 2 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {prepared.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color, height: kind === 'bar' ? 8 : 2, width: kind === 'bar' ? 8 : 16, borderRadius: kind === 'bar' ? 2 : 9999 }} />
                {s.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-steel-700 underline-offset-2 hover:underline"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      <div ref={containerRef} className={cn('relative mt-3', showTable && 'hidden')}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}. Use the left and right arrow keys to read values, or show the table.`}
          tabIndex={0}
          className="block max-w-full touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {sharedUnit && (
            <text x={0} y={10} fontSize={11} fill={AXIS_TEXT}>
              {sharedUnit}
            </text>
          )}
          {y.ticks.map((tick, i) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={tick === 0 && y.min < 0 ? '#b8c0cc' : GRID}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={margin.left - 8} y={yScale(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular-nums">
                {yLabels[i]}
              </text>
            </g>
          ))}

          {kind === 'bar'
            ? xs.map((x, i) => (i % barTickEvery === 0 ? xLabel(xScale(x), formatX(x, isTime, withDay), x) : null))
            : xTicks.map((tick) => xLabel(xScale(tick.value), tick.label, tick.value))}

          {kind === 'line' &&
            prepared.map((s) => {
              const d = bandPath(s.points)
              return d ? <path key={`band-${s.id}`} d={d} fill={s.color} opacity={0.14} /> : null
            })}

          {kind === 'line' &&
            prepared.map((s) => (
              <g key={s.id}>
                <path
                  d={linePath(s.points)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Points with no neighbour to join (sparse series, e.g.
                    quarterly releases on a monthly axis) get a marker. */}
                {s.points.map((p, i) =>
                  p.y !== null && (s.points[i - 1]?.y ?? null) === null && (s.points[i + 1]?.y ?? null) === null ? (
                    <circle key={p.x} cx={xScale(p.x)} cy={yScale(p.y)} r={4} fill={s.color} stroke="white" strokeWidth={2} />
                  ) : null,
                )}
              </g>
            ))}

          {kind === 'bar' &&
            (() => {
              const n = prepared.length
              const barW = Math.max(2, Math.min(24, (band * 0.72 - (n - 1) * 2) / n))
              const groupW = n * barW + (n - 1) * 2
              const zero = yScale(Math.max(y.min, Math.min(0, y.max)))
              return prepared.flatMap((s, si) =>
                s.points.map((p) =>
                  p.y === null ? null : (
                    <path
                      key={`${s.id}-${p.x}`}
                      d={barPath(xScale(p.x) - groupW / 2 + si * (barW + 2), barW, zero, yScale(p.y))}
                      fill={s.color}
                      opacity={activeX === null || activeX === p.x ? 1 : 0.55}
                    />
                  ),
                ),
              )
            })()}

          {labels.map((l) => (
            <g key={`label-${l.s.id}`}>
              <text x={margin.left + plotW + 8} y={l.y} dy="0.32em" fontSize={11} fill={AXIS_TEXT}>
                {endLabel(l.s)}
              </text>
            </g>
          ))}

          {activeX !== null && kind === 'line' && (
            <g pointerEvents="none">
              <line
                x1={xScale(activeX)}
                x2={xScale(activeX)}
                y1={margin.top}
                y2={margin.top + plotH}
                stroke={AXIS_TEXT}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {activeValues.map(({ series: s, point }) =>
                point && point.y !== null ? (
                  <circle key={s.id} cx={xScale(activeX)} cy={yScale(point.y)} r={4.5} fill={s.color} stroke="white" strokeWidth={2} />
                ) : null,
              )}
            </g>
          )}
        </svg>

        {activeX !== null && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-md shadow-navy/10"
            style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
          >
            <p className="font-semibold" style={{ color: INK }}>
              {formatX(activeX, isTime, withDay)}
            </p>
            <ul className="mt-1 space-y-0.5">
              {activeValues.map(({ series: s, point }) => (
                <li key={s.id} className="flex items-center gap-2 text-muted-foreground">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.label}</span>
                  <span className="ml-auto pl-3 font-medium tabular-nums" style={{ color: INK }}>
                    {point && point.y !== null ? formatNumber(point.y) : '–'}
                    {point && point.y !== null && s.unit ? ` ${s.unit}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showTable && <ChartTable id={tableId} prepared={prepared} xs={xs} isTime={isTime} withDay={withDay} />}
    </figure>
  )
}

const TABLE_ROWS = 400

function ChartTable({
  id,
  prepared,
  xs,
  isTime,
  withDay,
}: {
  id: string
  prepared: Prepared[]
  xs: number[]
  isTime: boolean
  withDay: boolean
}) {
  const rows = xs.slice(-TABLE_ROWS).reverse()
  return (
    <div id={id} className="mt-3 max-h-96 overflow-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs tabular-nums">
        <thead className="sticky top-0 bg-secondary text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {isTime ? 'Date' : 'x'}
            </th>
            {prepared.map((s) => (
              <th key={s.id} scope="col" className="px-3 py-2 text-right font-medium">
                {s.label}
                {s.unit ? ` (${s.unit})` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x} className="border-t border-border">
              <th scope="row" className="px-3 py-1.5 font-normal text-muted-foreground">
                {formatX(x, isTime, withDay)}
              </th>
              {prepared.map((s) => {
                const p = s.byX.get(x)
                return (
                  <td key={s.id} className="px-3 py-1.5 text-right text-navy">
                    {p && p.y !== null ? formatNumber(p.y) : '–'}
                    {p && p.lo !== undefined && p.hi !== undefined ? (
                      <span className="text-muted-foreground">
                        {' '}
                        [{formatNumber(p.lo)}, {formatNumber(p.hi)}]
                      </span>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {xs.length > TABLE_ROWS && (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Showing the latest {TABLE_ROWS} of {xs.length} rows.
        </p>
      )}
    </div>
  )
}
