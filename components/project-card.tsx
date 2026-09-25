import type { ReactNode } from 'react'
import Link from 'next/link'
import { Braces, Plug, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProjectPreview } from '@/components/project-preview'
import { Freshness } from '@/components/freshness'
import { Sparkline } from '@/components/sparkline'
import {
  LifecycleBadge,
  StackChips,
  TypeLine,
  apiChipClass,
  languageChipClass,
  toolChipClass,
} from '@/components/project-badges'
import { EditableSelect, EditableTags, EditableText } from '@/components/admin/editable'
import { formatChange, formatValue, projectLifecycles, projectModes, projectTypes } from '@/lib/project-meta'
import type { PublicProject } from '@/lib/public-content'

export const projectStatuses = projectLifecycles
export const projectKinds = ['map', 'chart', 'dashboard', 'model'] as const

type CardFields = 'title' | 'summary' | 'category' | 'status' | 'kind' | 'tags' | 'projectType' | 'mode' | 'languages' | 'apis' | 'featured'

export type ProjectCardEdit = {
  onChange: (patch: Partial<Pick<PublicProject, CardFields>>) => void
  sectors: readonly string[]
  // Rendered where the public card shows "View project →".
  pageControl: ReactNode
}

// The navy preview panel: the project's latest headline figure and trend
// when it publishes output, otherwise the illustration picked by `kind`.
// `feature` is the larger version used by Home's Featured Projects.
export function ProjectLivePanel({ project, variant = 'card' }: { project: PublicProject; variant?: 'card' | 'feature' }) {
  const output = project.output
  const headline = output?.headline
  if (!output || (!headline && output.spark.length < 2)) {
    return <ProjectPreview kind={project.kind} />
  }
  const feature = variant === 'feature'
  // Changes read "+0.05%" or "−2.1": the unit is already on the value.
  const changeUnit = headline?.unit?.startsWith('%') ? headline.unit : undefined
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-700/40 via-navy to-navy" />
      {output.spark.length >= 2 && (
        <Sparkline
          values={output.spark}
          className={cn(
            'absolute opacity-90',
            feature ? 'left-8 top-16 h-24 w-[calc(100%-4rem)]' : 'right-5 top-14 h-12 w-1/2',
          )}
        />
      )}
      <div className={cn('absolute', feature ? 'inset-x-8 bottom-8' : 'inset-x-5 bottom-4')}>
        {headline && (
          <>
            <p className={cn('truncate text-white/70', feature ? 'text-sm' : 'text-xs')}>{headline.label}</p>
            <p
              className={cn(
                'mt-1 flex flex-wrap items-baseline gap-x-2 font-sans font-semibold tabular-nums tracking-tight text-white',
                feature ? 'text-4xl md:text-5xl' : 'text-3xl',
              )}
            >
              {formatValue(headline.value, headline.unit)}
              {headline.change !== undefined && (
                <span className={cn('font-medium text-white/70', feature ? 'text-base' : 'text-sm')}>
                  {formatChange(headline.change, changeUnit)}
                </span>
              )}
            </p>
          </>
        )}
        <Freshness iso={output.updatedAt} className={cn('mt-1 block text-white/60', feature ? 'text-xs' : 'text-[11px]')} />
      </div>
    </div>
  )
}

// One project card as it appears on /projects. The admin Projects editor
// renders the same card with `edit`.
export function ProjectCard({ project, edit }: { project: PublicProject; edit?: ProjectCardEdit }) {
  const sectorPill = (
    <span className="rounded-full bg-steel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
      {project.category}
    </span>
  )

  const body = (
    <>
      <div className="relative h-48 overflow-hidden bg-navy">
        <ProjectLivePanel project={project} />
        {edit ? (
          <>
            <span className="absolute left-4 top-4">
              <EditableSelect
                value={project.category}
                options={edit.sectors}
                label="Sector"
                className="outline-white/40 hover:outline-white/80"
                onChange={(category) => edit.onChange({ category })}
              >
                {sectorPill}
              </EditableSelect>
            </span>
            {!project.output && (
              <span className="absolute bottom-3 right-3">
                <EditableSelect
                  value={project.kind}
                  options={projectKinds.map((kind) => ({ value: kind, label: `Preview: ${kind}` }))}
                  label="Preview illustration"
                  className="outline-white/40 hover:outline-white/80"
                  onChange={(kind) => edit.onChange({ kind: kind as PublicProject['kind'] })}
                >
                  <span className="rounded-full bg-white/15 px-3 py-1 font-sans text-xs font-medium text-white backdrop-blur">
                    Preview: {project.kind} ▾
                  </span>
                </EditableSelect>
              </span>
            )}
          </>
        ) : (
          <span className="absolute left-4 top-4">{sectorPill}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {edit ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <EditableSelect
              value={project.projectType}
              options={projectTypes}
              label="Project type"
              className="rounded-sm"
              onChange={(projectType) => edit.onChange({ projectType })}
            >
              <span className="px-1">{projectTypes.find((t) => t.value === project.projectType)?.label ?? project.projectType} ▾</span>
            </EditableSelect>
            <span aria-hidden>·</span>
            <EditableSelect
              value={project.mode}
              options={projectModes}
              label="Mode"
              className="rounded-sm"
              onChange={(mode) => edit.onChange({ mode })}
            >
              <span className="px-1">{projectModes.find((m) => m.value === project.mode)?.label ?? project.mode} ▾</span>
            </EditableSelect>
            <button
              type="button"
              aria-pressed={project.featured}
              onClick={() => edit.onChange({ featured: !project.featured })}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors',
                project.featured
                  ? 'bg-navy text-white'
                  : 'border border-dashed border-steel/40 text-steel-700 hover:border-steel hover:bg-steel/5',
              )}
            >
              <Star className={cn('size-3.5', project.featured && 'fill-current')} />
              {project.featured ? 'Featured on Home' : 'Feature on Home'}
            </button>
          </div>
        ) : (
          <TypeLine projectType={project.projectType} mode={project.mode} updateFrequency={project.updateFrequency} />
        )}
        {edit ? (
          <>
            <EditableText
              as="h2"
              value={project.title}
              label="Title"
              placeholder="Project title"
              className="mt-2 font-serif text-2xl leading-snug tracking-tight text-navy"
              onChange={(title) => edit.onChange({ title })}
            />
            <EditableText
              as="p"
              value={project.summary}
              label="Summary"
              placeholder="A short summary of the project (at least 20 characters)"
              multiline
              className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground"
              onChange={(summary) => edit.onChange({ summary })}
            />
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Languages">
                <Braces aria-hidden className="size-3.5 text-muted-foreground" />
                <EditableTags
                  tags={project.languages}
                  label="language"
                  chipClassName={languageChipClass}
                  onChange={(languages) => edit.onChange({ languages })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="APIs">
                <Plug aria-hidden className="size-3.5 text-muted-foreground" />
                <EditableTags
                  tags={project.apis}
                  label="API"
                  chipClassName={apiChipClass}
                  onChange={(apis) => edit.onChange({ apis })}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-2 font-serif text-2xl leading-snug tracking-tight text-navy transition-colors group-hover:text-steel-700">
              {project.title}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {project.summary}
            </p>
            <StackChips languages={project.languages} apis={project.apis} className="mt-4" />
          </>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {edit ? (
            <EditableSelect
              value={project.status}
              options={projectStatuses}
              label="Lifecycle"
              onChange={(status) => edit.onChange({ status })}
            >
              <LifecycleBadge status={project.status} always />
            </EditableSelect>
          ) : (
            <LifecycleBadge status={project.status} />
          )}
          {edit ? (
            <EditableTags
              tags={project.tags}
              label="tool"
              chipClassName={toolChipClass}
              onChange={(tags) => edit.onChange({ tags })}
            />
          ) : (
            project.tags.map((tag) => (
              <span key={tag} className={toolChipClass}>
                {tag}
              </span>
            ))
          )}
          {edit ? (
            <span className="ml-auto">{edit.pageControl}</span>
          ) : (
            <span className="ml-auto text-sm font-semibold text-steel-700 transition-colors group-hover:text-navy">
              View project &rarr;
            </span>
          )}
        </div>
      </div>
    </>
  )

  if (edit) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm shadow-navy/5">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm shadow-navy/5 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/10"
    >
      {body}
    </Link>
  )
}
