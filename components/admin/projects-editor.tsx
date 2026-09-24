'use client'

import { useCallback } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ProjectCard } from '@/components/project-card'
import { EditingBanner } from '@/components/admin/admin-bar'
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
import { DocumentControl, type DocumentState } from '@/components/admin/document-control'
import { uploadFile } from '@/components/admin/upload'
import { focusItem, moveItem, newClientKey, todayIso, useEditorState } from '@/components/admin/use-editor-state'
import { saveProjectsPageAction } from '@/app/admin/editor-actions'
import { slugify, type DocumentChange } from '@/lib/validations'
import type { PublicProject } from '@/lib/public-content'
import type { PageHeaderContent } from '@/lib/site-content-shared'

// /admin/projects: the public Projects page rendered with the same
// components (PageHeader, ProjectCard), in edit mode.

type ProjectFields = {
  slug: string
  title: string
  category: string
  status: string
  kind: string
  date: string
  summary: string
  tags: string[]
}

export type ProjectsEditorData = {
  header: PageHeaderContent
  loadError: boolean
  rows: (ProjectFields & {
    id: number
    published: boolean
    contentType: string
    pdfUrl: string | null
    pdfFilename: string | null
    latexSource: string | null
  })[]
  defaults: ProjectFields[]
}

type Row = ProjectFields & {
  clientKey: string
  id: number | null
  published: boolean
  removed: boolean
  slugTouched: boolean
  contentType: string
  pdfUrl: string | null
  pdfFilename: string | null
  latexSource: string | null
  doc: DocumentState
}

type State = { header: PageHeaderContent; rows: Row[] }

function build(data: ProjectsEditorData): State {
  const rows: Row[] =
    data.rows.length > 0 || data.loadError
      ? data.rows.map((row) => ({
          ...row,
          clientKey: `project-${row.id}`,
          removed: false,
          slugTouched: true,
          doc: { kind: 'keep' },
        }))
      : data.defaults.map((project, index) => ({
          ...project,
          clientKey: `default-project-${index}`,
          id: null,
          published: true,
          removed: false,
          slugTouched: true,
          contentType: 'pdf',
          pdfUrl: null,
          pdfFilename: null,
          latexSource: null,
          doc: { kind: 'keep' },
        }))
  return { header: data.header, rows }
}

export function ProjectsEditor({ data }: { data: ProjectsEditorData }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(data, build)

  const usingDefaults = !data.loadError && data.rows.length === 0
  const nothingPublished = !data.loadError && data.rows.length > 0 && !data.rows.some((row) => row.published)
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
      category: 'Dashboards',
      status: 'In progress',
      kind: 'dashboard',
      date: todayIso(),
      summary: '',
      tags: [],
      published: true,
      removed: false,
      slugTouched: false,
      contentType: 'pdf',
      pdfUrl: null,
      pdfFilename: null,
      latexSource: null,
      doc: { kind: 'keep' },
    }
    setState((s) => ({ ...s, rows: [...s.rows, row] }))
    focusItem(`item-${clientKey}`)
  }

  const save = useCallback(async () => {
    const rows = state.rows
    const uploads = rows.filter((row) => !row.removed && row.doc.kind === 'file')
    setStatus({
      kind: 'saving',
      message: uploads.length ? `Uploading ${uploads.length} PDF${uploads.length > 1 ? 's' : ''}…` : 'Saving…',
    })
    try {
      const items = []
      for (const row of rows) {
        if (row.removed) continue
        let document: DocumentChange = { kind: 'keep' }
        if (row.doc.kind === 'file') {
          const { key } = await uploadFile(row.doc.file, 'pdf')
          document = { kind: 'upload', key, filename: row.doc.file.name }
        } else if (row.doc.kind === 'latex') {
          document = { kind: 'latex', source: row.doc.source }
        }
        items.push({
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
          document,
        })
      }
      setStatus({ kind: 'saving', message: 'Saving…' })
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
          {usingDefaults && (
            <p className="mb-8 rounded-xl bg-steel/10 px-4 py-3 text-sm text-steel-700">
              No projects are saved yet, so visitors currently see these built-in examples. Edit them, delete
              them or add your own — saving stores them in the database.
            </p>
          )}
          {nothingPublished && (
            <p className="mb-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Every project is hidden, so visitors currently see the built-in example projects instead. Publish
              at least one to replace them.
            </p>
          )}

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
                pdfUrl: row.pdfUrl,
                date: row.date,
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
                      documentControl: (
                        <DocumentControl
                          current={{ url: row.pdfUrl, filename: row.pdfFilename, contentType: row.contentType }}
                          pending={row.doc}
                          latexSource={row.latexSource}
                          onChange={(doc) => updateRow(row.clientKey, { doc })}
                        />
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
