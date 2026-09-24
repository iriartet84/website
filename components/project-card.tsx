import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ProjectPreview } from '@/components/project-preview'
import { EditableSelect, EditableTags, EditableText } from '@/components/admin/editable'
import type { PublicProject } from '@/lib/public-content'

export const projectStatuses = ['Live', 'In progress', 'Coming soon'] as const
export const projectKinds = ['map', 'chart', 'dashboard', 'model'] as const

const statusStyles: Record<string, string> = {
  Live: 'bg-steel/15 text-steel-700',
  'In progress': 'bg-navy text-white',
  'Coming soon': 'bg-secondary text-muted-foreground',
}

const tagClass = 'rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700'

export type ProjectCardEdit = {
  onChange: (
    patch: Partial<Pick<PublicProject, 'title' | 'summary' | 'category' | 'status' | 'kind' | 'tags'>>,
  ) => void
  // Rendered where the public card shows "View project →".
  documentControl: ReactNode
}

// One project card as it appears on /projects. Moved out of
// app/projects/page.tsx unchanged so the admin Projects editor can render
// the same card with `edit`.
export function ProjectCard({ project, edit }: { project: PublicProject; edit?: ProjectCardEdit }) {
  const statusChip = (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        statusStyles[project.status] ?? 'bg-secondary text-navy',
      )}
    >
      {project.status}
    </span>
  )

  const body = (
    <>
      <div className="relative h-48 overflow-hidden bg-navy">
        <ProjectPreview kind={project.kind} />
        {edit ? (
          <>
            <span className="absolute left-4 top-4 rounded-full bg-steel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              <EditableText
                value={project.category}
                label="Category"
                className="outline-white/40 hover:outline-white/80 focus:outline-white"
                onChange={(category) => edit.onChange({ category })}
              />
            </span>
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
          </>
        ) : (
          <span className="absolute left-4 top-4 rounded-full bg-steel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {project.category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {edit ? (
          <>
            <EditableText
              as="h2"
              value={project.title}
              label="Title"
              placeholder="Project title"
              className="font-serif text-2xl leading-snug tracking-tight text-navy"
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
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl leading-snug tracking-tight text-navy transition-colors group-hover:text-steel-700">
              {project.title}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {project.summary}
            </p>
          </>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {edit ? (
            <EditableSelect
              value={project.status}
              options={projectStatuses}
              label="Status"
              onChange={(status) => edit.onChange({ status })}
            >
              {statusChip}
            </EditableSelect>
          ) : (
            statusChip
          )}
          {edit ? (
            <EditableTags tags={project.tags} chipClassName={tagClass} onChange={(tags) => edit.onChange({ tags })} />
          ) : (
            project.tags.map((tag) => (
              <span key={tag} className={tagClass}>
                {tag}
              </span>
            ))
          )}
          {edit ? (
            <span className="ml-auto">{edit.documentControl}</span>
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
