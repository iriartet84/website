import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppWindow, BookOpen, Braces, Database, ExternalLink, FileText, FolderGit2, Link2, Plug } from 'lucide-react'
import { PdfViewer } from '@/components/pdf-viewer'
import { Markdown } from '@/components/markdown'
import { KeyFigures } from '@/components/key-figures'
import { ProjectChart } from '@/components/project-chart'
import { ProjectEmbed } from '@/components/project-embed'
import { Freshness } from '@/components/freshness'
import {
  LifecycleBadge,
  StackChips,
  TypeLine,
  apiChipClass,
  languageChipClass,
  toolChipClass,
} from '@/components/project-badges'
import { EditableSelect, EditableTags, EditableText } from '@/components/admin/editable'
import {
  labelOf,
  linkKinds,
  projectLifecycles,
  projectModes,
  projectTypes,
  updateFrequencies,
  type ProjectLink,
  type ProjectSection,
} from '@/lib/project-meta'
import type { PublicProjectDetail } from '@/lib/public-content'

// The project page (/projects/[slug]): a header with the project's labels
// and links, then its sections in order. The admin page editor renders the
// same header (with `edit`) and the same section views, so the preview is
// the page.

const linkIcons: Record<string, typeof Link2> = {
  repository: FolderGit2,
  application: AppWindow,
  documentation: BookOpen,
  paper: FileText,
  dataset: Database,
  other: Link2,
}

export function ProjectLinks({ links }: { links: ProjectLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Project links">
      {links.map((link) => {
        const Icon = linkIcons[link.kind] ?? Link2
        return (
          <li key={`${link.kind}-${link.url}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:border-steel/40 hover:bg-secondary"
            >
              <Icon aria-hidden className="size-4 text-steel-700" />
              {link.label || labelOf(linkKinds, link.kind)}
              <ExternalLink aria-hidden className="size-3 text-muted-foreground" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

type HeaderFields =
  | 'title'
  | 'summary'
  | 'category'
  | 'status'
  | 'tags'
  | 'projectType'
  | 'mode'
  | 'languages'
  | 'apis'

export type ProjectHeaderEdit = {
  onChange: (patch: Partial<Pick<PublicProjectDetail, HeaderFields>>) => void
  sectors: readonly string[]
  // Replaces the links row.
  linksControl: ReactNode
}

export function ProjectHeader({ project, edit }: { project: PublicProjectDetail; edit?: ProjectHeaderEdit }) {
  const sectorLabel = (
    <span className="text-sm font-bold uppercase tracking-[0.14em] text-steel-700">{project.category}</span>
  )
  const output = project.fullOutput
  const liveMode = project.mode === 'live' || project.mode === 'automated'
  const frequency = project.updateFrequency && project.updateFrequency !== 'irregular'
    ? labelOf(updateFrequencies, project.updateFrequency).toLowerCase()
    : null

  return (
    <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <Link href="/projects" className="text-sm font-medium text-steel-700 transition-colors hover:text-navy">
          &larr; Projects
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {edit ? (
            <>
              <EditableSelect
                value={project.category}
                options={edit.sectors}
                label="Sector"
                className="rounded-sm"
                onChange={(category) => edit.onChange({ category })}
              >
                {sectorLabel}
              </EditableSelect>
              <EditableSelect
                value={project.status}
                options={projectLifecycles}
                label="Lifecycle"
                onChange={(status) => edit.onChange({ status })}
              >
                <LifecycleBadge status={project.status} always />
              </EditableSelect>
            </>
          ) : (
            <>
              {sectorLabel}
              <LifecycleBadge status={project.status} />
            </>
          )}
        </div>
        {edit ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <EditableSelect
              value={project.projectType}
              options={projectTypes}
              label="Project type"
              className="rounded-sm"
              onChange={(projectType) => edit.onChange({ projectType })}
            >
              <span className="px-1">{labelOf(projectTypes, project.projectType)} ▾</span>
            </EditableSelect>
            <span aria-hidden>·</span>
            <EditableSelect
              value={project.mode}
              options={projectModes}
              label="Mode"
              className="rounded-sm"
              onChange={(mode) => edit.onChange({ mode })}
            >
              <span className="px-1">{labelOf(projectModes, project.mode)} ▾</span>
            </EditableSelect>
          </div>
        ) : (
          <TypeLine
            className="mt-3"
            projectType={project.projectType}
            mode={project.mode}
            updateFrequency={project.updateFrequency}
          />
        )}
        {edit ? (
          <>
            <EditableText
              as="h1"
              value={project.title}
              label="Title"
              placeholder="Project title"
              className="mt-4 block font-serif text-4xl tracking-tight text-navy md:text-5xl"
              onChange={(title) => edit.onChange({ title })}
            />
            <EditableText
              as="p"
              value={project.summary}
              label="Summary"
              placeholder="A short summary of the project (at least 20 characters)"
              multiline
              className="mt-5 block max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
              onChange={(summary) => edit.onChange({ summary })}
            />
            <div className="mt-5 space-y-2">
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
              <div className="flex flex-wrap items-center gap-2">
                <EditableTags
                  tags={project.tags}
                  label="tool"
                  chipClassName={toolChipClass}
                  onChange={(tags) => edit.onChange({ tags })}
                />
              </div>
            </div>
            <div className="mt-6">{edit.linksControl}</div>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl">{project.title}</h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
              {project.summary}
            </p>
            <StackChips languages={project.languages} apis={project.apis} className="mt-5" />
            {project.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className={toolChipClass}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {project.links.length > 0 && (
              <div className="mt-6">
                <ProjectLinks links={project.links} />
              </div>
            )}
          </>
        )}
        {output && (
          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {liveMode && <span aria-hidden className="size-1.5 rounded-full bg-steel" />}
            <Freshness iso={output.updatedAt} prefix="Data updated" />
            {liveMode && frequency && <span>· refreshed {frequency}</span>}
            {output.status && output.status !== 'ok' && (
              <span className="font-medium text-navy">
                · The latest run reported a problem; some figures may be out of date.
              </span>
            )}
          </p>
        )}
      </div>
    </header>
  )
}

function SectionShell({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  const headingId = `section-${id}`
  return (
    <section aria-labelledby={heading ? headingId : undefined} className="scroll-mt-24">
      {heading && (
        <h2 id={headingId} className="font-serif text-2xl tracking-tight text-navy md:text-3xl">
          {heading}
        </h2>
      )}
      <div className={heading ? 'mt-5' : undefined}>{children}</div>
    </section>
  )
}

// One section as visitors see it, or null when it has nothing to show yet
// (a chart before the project publishes output, an empty write-up...).
export function ProjectSectionView({ section, project }: { section: ProjectSection; project: PublicProjectDetail }) {
  const output = project.fullOutput
  switch (section.type) {
    case 'text':
      if (!section.body.trim()) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <Markdown>{section.body}</Markdown>
        </SectionShell>
      )
    case 'figures': {
      const all = output?.headline ?? []
      const items = section.ids.length ? all.filter((item) => section.ids.includes(item.id)) : all
      if (items.length === 0) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <KeyFigures items={items} />
          {output?.notes && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{output.notes}</p>}
        </SectionShell>
      )
    }
    case 'chart': {
      const all = output?.series ?? []
      const chosen = section.seriesIds.length
        ? section.seriesIds.map((id) => all.find((s) => s.id === id)).filter((s) => s !== undefined)
        : all.slice(0, 1)
      if (chosen.length === 0) return null
      const title = section.heading || chosen.map((s) => s.label).join(', ')
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <ProjectChart series={chosen} kind={section.kind} title={title} />
          {section.note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{section.note}</p>}
        </SectionShell>
      )
    }
    case 'app':
      if (!project.embedUrl) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <ProjectEmbed url={project.embedUrl} title={section.heading || project.title} height={section.height} />
        </SectionShell>
      )
    case 'findings': {
      const items = section.items.filter((item) => item.trim())
      if (items.length === 0) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <ol className="space-y-3">
            {items.map((item, i) => (
              <li key={i} className="flex gap-4 text-base leading-relaxed text-foreground">
                <span className="mt-0.5 font-sans text-sm font-semibold tabular-nums text-steel-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </SectionShell>
      )
    }
    case 'sources': {
      if (section.items.length === 0) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="text-navy">{item.label}</span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-steel-700 hover:underline"
                  >
                    Source <ExternalLink aria-hidden className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </SectionShell>
      )
    }
    case 'downloads': {
      const items = [...section.items, ...(output?.downloads ?? [])]
      if (items.length === 0) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <ul className="flex flex-wrap gap-2">
            {items.map((item, i) => (
              <li key={i}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800"
                >
                  <Database aria-hidden className="size-4" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </SectionShell>
      )
    }
    case 'document':
      if (!project.pdfUrl) return null
      return (
        <SectionShell id={section.id} heading={section.heading}>
          <PdfViewer url={project.pdfUrl} title={project.title} filename={project.pdfFilename} />
        </SectionShell>
      )
  }
}

export function ProjectInTheWorks() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
      <p className="text-sm text-muted-foreground">
        This project is still in the works &mdash; the interactive build or document will appear here soon.
      </p>
    </div>
  )
}

export function ProjectBody({ project }: { project: PublicProjectDetail }) {
  // Projects without sections keep the original page: their document, or
  // the "in the works" note.
  if (project.sections.length === 0) {
    return project.pdfUrl ? (
      <PdfViewer url={project.pdfUrl} title={project.title} filename={project.pdfFilename} />
    ) : (
      <ProjectInTheWorks />
    )
  }
  const views = project.sections
    .map((section) => ({ section, view: ProjectSectionView({ section, project }) }))
    .filter((entry) => entry.view !== null)
  if (views.length === 0) return <ProjectInTheWorks />
  return (
    <div className="space-y-14">
      {views.map(({ section, view }) => (
        <div key={section.id}>{view}</div>
      ))}
    </div>
  )
}
