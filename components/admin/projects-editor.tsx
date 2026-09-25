'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { ExternalLink, Plus, Star } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ProjectCard } from '@/components/project-card'
import { EditingBanner } from '@/components/admin/admin-bar'
import { OutputHealthBadge } from '@/components/admin/output-health'
import { confirmLeaveWithUnsavedChanges } from '@/components/admin/unsaved-guard'
import {
  AddItemButton,
  EditableItem,
  ItemToolbar,
  RemovedItem,
  SaveBar,
  SettingsField,
  SettingsPopover,
  scrollToItem,
  settingsInput,
} from '@/components/admin/editor-ui'
import { focusItem, moveItem, newClientKey, todayIso, useEditorState } from '@/components/admin/use-editor-state'
import { saveProjectsPageAction } from '@/app/admin/editor-actions'
import { slugify } from '@/lib/validations'
import { projectSectors, type OutputHealth, type OutputSummary } from '@/lib/project-meta'
import type { PublicProject } from '@/lib/public-content'
import type { PageHeaderContent } from '@/lib/site-content-shared'

// /admin/projects: the public Projects page rendered with the same
// components (PageHeader, ProjectCard), in edit mode. Cards are edited
// here; each project's page (write-up, charts, links, live data, document)
// is edited on its own page, /admin/projects/[id].

type ProjectFields = {
  slug: string
  title: string
  category: string
  status: string
  kind: string
  date: string
  summary: string
  tags: string[]
  projectType: string
  mode: string
  languages: string[]
  apis: string[]
  featured: boolean
}

export type ProjectsEditorData = {
  header: PageHeaderContent
  loadError: boolean
  rows: (ProjectFields & {
    id: number
    published: boolean
    updateFrequency: string | null
    output: OutputSummary | null
    health: OutputHealth
    outputError: string | null
  })[]
}

type Row = ProjectFields & {
  clientKey: string
  id: number | null
  published: boolean
  removed: boolean
  slugTouched: boolean
  // Read-only here (set by the page editor and the pipeline).
  updateFrequency: string | null
  output: OutputSummary | null
  health: OutputHealth
  outputError: string | null
}

type State = { header: PageHeaderContent; rows: Row[] }

function build(data: ProjectsEditorData): State {
  return {
    header: data.header,
    rows: data.rows.map((row) => ({
      ...row,
      clientKey: `project-${row.id}`,
      removed: false,
      slugTouched: true,
    })),
  }
}

export function ProjectsEditor({ data }: { data: ProjectsEditorData }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(data, build)

  const noProjects = !data.loadError && data.rows.length === 0
  const nothingPublished = !data.loadError && data.rows.length > 0 && !data.rows.some((row) => row.published)
  const featuredCount = state.rows.filter((row) => !row.removed && row.featured && row.published).length
  const errorKey = status.kind === 'error' ? status.clientKey : undefined

  const updateRow = (clientKey: string, patch: Partial<Row>) =>
    setState((s) => ({
      ...s,
      rows: s.rows.map((row) => {
        if (row.clientKey !== clientKey) return row
        const next = { ...row, ...patch }
        if (patch.title !== undefined && !row.slugTouched) next.slug = slugify(patch.title)
        return next
      }),
    }))

  const addProject = () => {
    const clientKey = newClientKey('project')
    const row: Row = {
      clientKey,
      id: null,
      slug: '',
      title: '',
      category: projectSectors[0],
      status: 'In progress',
      kind: 'dashboard',
      date: todayIso(),
      summary: '',
      tags: [],
      projectType: 'analysis',
      mode: 'static',
      languages: [],
      apis: [],
      featured: false,
      published: true,
      removed: false,
      slugTouched: false,
      updateFrequency: null,
      output: null,
      health: 'none',
      outputError: null,
    }
    setState((s) => ({ ...s, rows: [...s.rows, row] }))
    focusItem(`item-${clientKey}`)
  }

  const save = useCallback(async () => {
    const rows = state.rows
    setStatus({ kind: 'saving', message: 'Saving…' })
    try {
      const items = rows
        .filter((row) => !row.removed)
        .map((row) => ({
          clientKey: row.clientKey,
          id: row.id,
          title: row.title.trim(),
          slug: row.slug.trim(),
          category: row.category.trim(),
          status: row.status,
          kind: row.kind,
          date: row.date,
          summary: row.summary.trim(),
          tags: row.tags.map((tag) => tag.trim()).filter(Boolean),
          published: row.published,
          projectType: row.projectType,
          mode: row.mode,
          languages: row.languages.map((tag) => tag.trim()).filter(Boolean),
          apis: row.apis.map((tag) => tag.trim()).filter(Boolean),
          featured: row.featured,
        }))
      const result = await saveProjectsPageAction({
        header: state.header,
        items,
        deletedIds: rows.filter((row) => row.removed && row.id !== null).map((row) => row.id as number),
      })
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error, clientKey: result.clientKey })
        return
      }
      markSaved(state)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Saving failed.' })
    }
  }, [state, setStatus, markSaved])

  const liveCount = state.rows.length

  return (
    <>
      <EditingBanner page="Projects">
        <a href="/projects" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          Open /projects <ExternalLink className="size-3" />
        </a>
      </EditingBanner>

      <main className="pb-32">
        <PageHeader
          eyebrow={state.header.eyebrow}
          title={state.header.title}
          description={state.header.description}
          edit={{ onChange: (field, value) => setState((s) => ({ ...s, header: { ...s.header, [field]: value } })) }}
        />

        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
          {data.loadError && (
            <p className="mb-8 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Projects couldn&rsquo;t be loaded from the database, so they aren&rsquo;t shown here. Saving now would
              only update the page header.
            </p>
          )}
          {noProjects && (
            <p className="mb-8 rounded-xl bg-steel/10 px-4 py-3 text-sm text-steel-700">
              No projects yet, so visitors see a &ldquo;coming soon&rdquo; message. Add your first project below,
              save, then use <span className="font-medium">Edit page</span> to write it up and connect its live data.
            </p>
          )}
          {nothingPublished && (
            <p className="mb-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Every project is hidden, so visitors see the &ldquo;coming soon&rdquo; message. Publish at least one to
              show it.
            </p>
          )}
          <p className="mb-8 flex items-start gap-2 text-sm text-muted-foreground">
            <Star className="mt-0.5 size-4 shrink-0 text-steel-700" />
            <span>
              {featuredCount > 0
                ? `${featuredCount} published project${featuredCount > 1 ? 's are' : ' is'} featured. Home shows Featured Projects in place of Research Focus — one project per sector (the first one in this order).`
                : 'Feature a published project to show it on Home. While none is featured, Home keeps showing Research Focus.'}
            </span>
          </p>

          <div className="grid gap-6 gap-y-10 md:grid-cols-2">
            {state.rows.map((row, index) => {
              if (row.removed) {
                return (
                  <RemovedItem
                    key={row.clientKey}
                    className="self-start"
                    label={row.title ? `“${row.title}”` : 'This project'}
                    onUndo={() => updateRow(row.clientKey, { removed: false })}
                  />
                )
              }
              const project: PublicProject = {
                slug: row.slug,
                title: row.title,
                category: row.category,
                summary: row.summary,
                tags: row.tags,
                status: row.status,
                kind: row.kind as PublicProject['kind'],
                pdfUrl: null,
                date: row.date,
                projectType: row.projectType,
                mode: row.mode,
                languages: row.languages,
                apis: row.apis,
                featured: row.featured,
                updateFrequency: row.updateFrequency,
                output: row.output,
              }
              return (
                <EditableItem
                  key={row.clientKey}
                  id={`item-${row.clientKey}`}
                  published={row.published}
                  isNew={row.id === null}
                  highlighted={errorKey === row.clientKey}
                  toolbarClassName="-top-4 right-3"
                  toolbar={
                    <ItemToolbar
                      itemLabel="project"
                      direction="horizontal"
                      canMoveBack={index > 0}
                      canMoveForward={index < liveCount - 1}
                      onMoveBack={() => setState((s) => ({ ...s, rows: moveItem(s.rows, index, index - 1) }))}
                      onMoveForward={() => setState((s) => ({ ...s, rows: moveItem(s.rows, index, index + 1) }))}
                      published={row.published}
                      onTogglePublished={() => updateRow(row.clientKey, { published: !row.published })}
                      onRemove={() =>
                        row.id === null
                          ? setState((s) => ({ ...s, rows: s.rows.filter((r) => r.clientKey !== row.clientKey) }))
                          : updateRow(row.clientKey, { removed: true })
                      }
                      settings={
                        <SettingsPopover title="Project settings" triggerLabel="Project settings">
                          <SettingsField
                            label="Address (slug)"
                            hint={
                              <>
                                /projects/{row.slug || '…'}{' '}
                                <button
                                  type="button"
                                  className="font-medium text-steel-700 underline-offset-2 hover:underline"
                                  onClick={() => updateRow(row.clientKey, { slug: slugify(row.title), slugTouched: true })}
                                >
                                  Generate from title
                                </button>
                              </>
                            }
                          >
                            <input
                              className={settingsInput}
                              value={row.slug}
                              onChange={(event) => updateRow(row.clientKey, { slug: event.target.value, slugTouched: true })}
                            />
                          </SettingsField>
                          <SettingsField label="Date" hint="Not shown on the card; used to sort projects in the same position.">
                            <input
                              type="date"
                              className={settingsInput}
                              value={row.date}
                              onChange={(event) => event.target.value && updateRow(row.clientKey, { date: event.target.value })}
                            />
                          </SettingsField>
                          {row.id !== null && row.published && (
                            <a
                              href={`/projects/${row.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:underline"
                            >
                              Open the project&rsquo;s public page <ExternalLink className="size-3" />
                            </a>
                          )}
                        </SettingsPopover>
                      }
                    />
                  }
                >
                  <ProjectCard
                    project={project}
                    edit={{
                      onChange: (patch) => updateRow(row.clientKey, patch),
                      sectors: projectSectors,
                      pageControl:
                        row.id === null ? (
                          <span className="text-xs text-muted-foreground">Save to edit its page</span>
                        ) : (
                          <span className="flex items-center gap-3">
                            <OutputHealthBadge health={row.health} error={row.outputError} />
                            <Link
                              href={`/admin/projects/${row.id}`}
                              onClick={(event) => {
                                if (!confirmLeaveWithUnsavedChanges()) event.preventDefault()
                              }}
                              className="text-sm font-semibold text-steel-700 transition-colors hover:text-navy"
                            >
                              Edit page &rarr;
                            </Link>
                          </span>
                        ),
                    }}
                  />
                </EditableItem>
              )
            })}
            <AddItemButton onClick={addProject} className="min-h-48">
              <Plus className="size-4" />
              Add a project
            </AddItemButton>
          </div>

          <p className="mt-12 text-center text-sm text-muted-foreground">
            New interactive projects are deployed here regularly. Check back soon.
          </p>
        </div>
      </main>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onDiscard={discard}
        onShowError={errorKey ? () => scrollToItem(`item-${errorKey}`) : undefined}
      />
    </>
  )
}
