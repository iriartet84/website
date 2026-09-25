import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { formatAbsoluteDate, formatChange, formatValue } from '@/lib/project-meta'
import type { OutputHeadline } from '@/lib/project-output'

// Headline figures from a project's output. Changes are shown with a
// direction arrow in neutral ink: "up" isn't good or bad by itself
// (inflation up, unemployment down), so no green/red.
export function KeyFigures({ items }: { items: OutputHeadline[] }) {
  if (items.length === 0) return null
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Arrow =
          item.change === undefined ? null : item.change > 0 ? ArrowUpRight : item.change < 0 ? ArrowDownRight : ArrowRight
        return (
          <div key={item.id} className="rounded-2xl border border-border bg-white p-5">
            <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
            <dd className="mt-2 font-sans text-3xl font-semibold tabular-nums tracking-tight text-navy">
              {formatValue(item.value, item.unit)}
            </dd>
            {(item.change !== undefined || item.asOf) && (
              <dd className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {item.change !== undefined && Arrow && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-navy">
                    <Arrow aria-hidden className="size-3.5" />
                    <span className="tabular-nums">{formatChange(item.change, item.unit)}</span>
                    <span className="sr-only"> since the previous estimate</span>
                  </span>
                )}
                {item.asOf && <span>as of {formatAbsoluteDate(item.asOf)}</span>}
              </dd>
            )}
            {item.note && <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.note}</dd>}
          </div>
        )
      })}
    </dl>
  )
}
