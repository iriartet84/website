import { CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OutputHealth } from '@/lib/project-meta'

// Admin-only status of a project's live data. Icon + words, never colour
// alone.
const styles: Record<Exclude<OutputHealth, 'none'>, { label: string; icon: typeof Clock; className: string }> = {
  current: { label: 'Data current', icon: CircleCheck, className: 'text-emerald-700' },
  overdue: { label: 'Data overdue', icon: Clock, className: 'text-amber-700' },
  failing: { label: 'Output failing', icon: TriangleAlert, className: 'text-destructive' },
}

export function OutputHealthBadge({
  health,
  error,
  className,
}: {
  health: OutputHealth
  error?: string | null
  className?: string
}) {
  if (health === 'none') return null
  const { label, icon: Icon, className: tone } = styles[health]
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-sans text-xs font-medium', tone, className)}
      title={health === 'failing' && error ? error : undefined}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  )
}
