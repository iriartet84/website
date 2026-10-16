import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// Small server-rendered building blocks of /admin/analytics.

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28 pt-12">
      <h2 className="font-serif text-2xl tracking-tight text-navy">{title}</h2>
      {description && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function Panel({
  title,
  note,
  className,
  children,
}: {
  title: string
  note?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl bg-white p-5 shadow-sm shadow-navy/5', className)}>
      <h3 className="font-medium text-navy">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}

// Change against the previous period. Only shown when the previous period
// has data; "new" otherwise (a percentage of zero is meaningless).
export function Delta({ current, previous, show }: { current: number; previous: number | null; show: boolean }) {
  if (!show || previous === null) return null
  if (previous === 0) {
    return current > 0 ? <span className="text-xs text-muted-foreground">no data before</span> : null
  }
  const change = ((current - previous) / previous) * 100
  const rounded = Math.round(change)
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        rounded > 0 ? 'text-emerald-700' : rounded < 0 ? 'text-rose-700' : 'text-muted-foreground',
      )}
      title={`Previous period: ${previous.toLocaleString('en-GB')}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {rounded > 0 ? '+' : ''}
      {rounded}%<span className="sr-only"> vs previous period</span>
    </span>
  )
}

export function Kpi({
  label,
  value,
  sub,
  delta,
  estimate,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  delta?: React.ReactNode
  estimate?: boolean
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm shadow-navy/5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {estimate && (
          <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-amber-800">
            est.
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-navy" title={value}>
        {value}
      </div>
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {delta}
        {sub && (
          <span className="min-w-0 truncate" title={typeof sub === 'string' ? sub : undefined}>
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

export function Chip({ label, removeHref }: { label: string; removeHref: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1 text-xs text-white">
      {label}
      <Link href={removeHref} aria-label={`Remove filter ${label}`} className="ml-1 rounded-full px-1 hover:bg-white/20">
        ×
      </Link>
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}
