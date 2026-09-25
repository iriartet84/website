import { Braces, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { labelOf, projectModes, projectTypes, updateFrequencies } from '@/lib/project-meta'

// The small labels every project carries — on its card, its page and the
// Home preview — so a visitor (or an employer) sees at a glance what kind
// of work it is and which languages and APIs it uses.

export const lifecycleStyles: Record<string, string> = {
  Live: 'bg-steel/15 text-steel-700',
  'In progress': 'bg-navy text-white',
  'Coming soon': 'bg-secondary text-muted-foreground',
}

// Only unfinished projects get a lifecycle badge; a launched ("Live")
// project doesn't need one, and it would read as a claim about live data.
export function LifecycleBadge({ status, always = false }: { status: string; always?: boolean }) {
  if (!always && status === 'Live') return null
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        lifecycleStyles[status] ?? 'bg-secondary text-navy',
      )}
    >
      {status}
    </span>
  )
}

const liveModes = new Set(['live', 'automated'])

// "Nowcast · Automatically updated · Daily"
export function TypeLine({
  projectType,
  mode,
  updateFrequency,
  className,
}: {
  projectType: string
  mode: string
  updateFrequency?: string | null
  className?: string
}) {
  const parts = [labelOf(projectTypes, projectType)]
  if (mode !== 'static') parts.push(labelOf(projectModes, mode))
  if (liveModes.has(mode) && updateFrequency && updateFrequency !== 'irregular') {
    parts.push(labelOf(updateFrequencies, updateFrequency))
  }
  return (
    <p className={cn('flex items-center gap-2 text-xs font-medium text-muted-foreground', className)}>
      {liveModes.has(mode) && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-steel" />}
      {parts.join(' · ')}
    </p>
  )
}

export const languageChipClass =
  'rounded-md border border-navy/15 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-navy'
export const apiChipClass =
  'rounded-md border border-steel/25 bg-steel/5 px-2 py-0.5 font-mono text-[11px] font-medium text-steel-700'
export const toolChipClass = 'rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700'

function Group({
  label,
  icon,
  items,
  chipClassName,
}: {
  label: string
  icon: React.ReactNode
  items: string[]
  chipClassName: string
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-muted-foreground" title={label}>
        {icon}
      </span>
      {items.map((item) => (
        <span key={item} className={chipClassName}>
          {item}
        </span>
      ))}
    </div>
  )
}

// Languages and APIs, each group marked by an icon (so it isn't told apart
// by colour alone) and named for screen readers.
export function StackChips({
  languages,
  apis,
  className,
}: {
  languages: string[]
  apis: string[]
  className?: string
}) {
  if (languages.length === 0 && apis.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      <Group
        label="Languages"
        icon={<Braces aria-hidden className="size-3.5" />}
        items={languages}
        chipClassName={languageChipClass}
      />
      <Group label="APIs" icon={<Plug aria-hidden className="size-3.5" />} items={apis} chipClassName={apiChipClass} />
    </div>
  )
}
