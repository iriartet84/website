'use client'

import { useCallback, useState } from 'react'
import { ExternalLink, Plus } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PaperArticle, PaperFilters } from '@/components/papers-list'
import { EditingBanner } from '@/components/admin/admin-bar'
import { editableOutline } from '@/components/admin/editable'
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
import { savePapersPageAction } from '@/app/admin/editor-actions'
import { slugify } from '@/lib/validations'
import type { PageHeaderContent } from '@/lib/site-content-shared'
import type { DocumentChange } from '@/lib/validations'

// /admin/papers: the public Papers & Briefs page rendered with the same
// components (PageHeader, PaperFilters, PaperArticle), in edit mode.

type PaperFields = {
  slug: string
  title: string
  category: string
  type: string
  date: string
  excerpt: string
  tags: string[]
}

export type PapersEditorData = {
  header: PageHeaderContent
  categories: string[]
  loadError: boolean
  rows: (PaperFields & {
    id: number
    published: boolean
    contentType: string
    pdfUrl: string | null
    pdfFilename: string | null
    latexSource: string | null
  })[]
  defaults: PaperFields[]
}

type Row = PaperFields & {
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

function build(data: PapersEditorData): State {
  const rows: Row[] =
    data.rows.length > 0 || data.loadError
      ? data.rows.map((row) => ({
          ...row,
          clientKey: `paper-${row.id}`,
          removed: false,
          slugTouched: true,
          doc: { kind: 'keep' },
        }))
      : data.defaults.map((paper, index) => ({
          ...paper,
          clientKey: `default-paper-${index}`,
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

const domId = (row: Row) => `item-${row.clientKey}`

export function PapersEditor({ data }: { data: PapersEditorData }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(data, build)
  const [filter, setFilter] = useState('All')

  const live = state.rows.filter((row) => !row.removed)
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

  // Reordering moves an item past its neighbour *in the current filter*, so
  // it behaves as expected while a category filter is active.
  const visibleIndexes = state.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => filter === 'All' || row.category === filter)
    .map(({ index }) => index)

  const move = (fullIndex: number, direction: -1 | 1) => {
    const position = visibleIndexes.indexOf(fullIndex)
    const target = visibleIndexes[position + direction]
    if (target === undefined) return
    setState((s) => ({ ...s, rows: moveItem(s.rows, fullIndex, target) }))
  }

  const addPaper = () => {
    const clientKey = newClientKey('paper')
    const row: Row = {
      clientKey,
      id: null,
      slug: '',
      title: '',
      category: filter !== 'All' ? filter : data.categories[0] ?? 'Macroeconomics',
      type: 'Paper',
      date: todayIso(),
      excerpt: '',
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
    setState((s) => ({ ...s, rows: [row, ...s.rows] }))
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
          category: row.category,
          type: row.type,
          date: row.date,
          excerpt: row.excerpt.trim(),
          tags: row.tags.map((tag) => tag.trim()).filter(Boolean),
          published: row.published,
          document,
        })
      }
      setStatus({ kind: 'saving', message: 'Saving…' })
      const result = await savePapersPageAction({
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

  return (
    <>
      <EditingBanner page="Papers & Briefs">
        <a href="/papers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          Open /papers <ExternalLink className="size-3" />
        </a>
      </EditingBanner>

      <main className="pb-32">
        <PageHeader
          eyebrow={state.header.eyebrow}
          title={state.header.title}
          description={state.header.description}
          edit={{ onChange: (field, value) => setState((s) => ({ ...s, header: { ...s.header, [field]: value } })) }}
        />

        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-16">
          {data.loadError && (
            <p className="mb-8 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Papers couldn&rsquo;t be loaded from the database, so they aren&rsquo;t shown here. Saving now would
              only update the page header.
            </p>
          )}
          {usingDefaults && (
            <p className="mb-8 rounded-xl bg-steel/10 px-4 py-3 text-sm text-steel-700">
              No papers are saved yet, so visitors currently see these built-in examples. Edit them, delete
              them or add your own — saving stores them in the database.
            </p>
          )}
          {nothingPublished && (
            <p className="mb-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Every paper is hidden, so visitors currently see the built-in example papers instead. Publish at
              least one to replace them.
            </p>
          )}

          <PaperFilters papers={live} categories={data.categories} filter={filter} onFilter={setFilter} />

          <div className="mt-8 space-y-10">
            <AddItemButton onClick={addPaper} className="py-4">
              <Plus className="size-4" />
              Add a paper{filter !== 'All' ? ` in ${filter}` : ''}
            </AddItemButton>

            {visibleIndexes.map((fullIndex) => {
              const row = state.rows[fullIndex]
              if (row.removed) {
                return (
                  <RemovedItem
                    key={row.clientKey}
                    label={row.title ? `“${row.title}”` : 'This paper'}
                    onUndo={() => updateRow(row.clientKey, { removed: false })}
                  />
                )
              }
              const position = visibleIndexes.indexOf(fullIndex)
              return (
                <EditableItem
                  key={row.clientKey}
                  id={domId(row)}
                  published={row.published}
                  isNew={row.id === null}
                  highlighted={errorKey === row.clientKey}
                  toolbarClassName="-top-5 right-0"
                  toolbar={
                    <ItemToolbar
                      itemLabel="paper"
                      canMoveBack={position > 0}
                      canMoveForward={position < visibleIndexes.length - 1}
                      onMoveBack={() => move(fullIndex, -1)}
                      onMoveForward={() => move(fullIndex, 1)}
                      published={row.published}
                      onTogglePublished={() => updateRow(row.clientKey, { published: !row.published })}
                      onRemove={() =>
                        row.id === null
                          ? setState((s) => ({ ...s, rows: s.rows.filter((r) => r.clientKey !== row.clientKey) }))
                          : updateRow(row.clientKey, { removed: true })
                      }
                      settings={
                        <SettingsPopover title="Paper settings" triggerLabel="Paper settings">
                          <SettingsField
                            label="Address (slug)"
                            hint={
                              <>
                                /papers/{row.slug || '…'}{' '}
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
                          <SettingsField label="Publication date" hint="Shown as the year; also used to sort papers with the same position.">
                            <input
                              type="date"
                              className={settingsInput}
                              value={row.date}
                              onChange={(event) => event.target.value && updateRow(row.clientKey, { date: event.target.value })}
                            />
                          </SettingsField>
                          {row.id !== null && row.published && (
                            <a
                              href={`/papers/${row.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:underline"
                            >
                              Open the paper&rsquo;s public page <ExternalLink className="size-3" />
                            </a>
                          )}
                        </SettingsPopover>
                      }
                    />
                  }
                >
                  <PaperArticle
                    paper={{
                      slug: row.slug,
                      title: row.title,
                      category: row.category,
                      year: row.date.slice(0, 4),
                      type: row.type,
                      excerpt: row.excerpt,
                      tags: row.tags,
                      pdfUrl: row.pdfUrl,
                      date: row.date,
                    }}
                    edit={{
                      categories: data.categories,
                      onChange: (patch) => updateRow(row.clientKey, patch),
                      yearControl: (
                        <SettingsPopover
                          title="Publication date"
                          triggerLabel="Change the publication date"
                          trigger={
                            <span className={`text-xs text-muted-foreground ${editableOutline}`}>{row.date.slice(0, 4)}</span>
                          }
                        >
                          <input
                            type="date"
                            className={settingsInput}
                            value={row.date}
                            onChange={(event) => event.target.value && updateRow(row.clientKey, { date: event.target.value })}
                          />
                        </SettingsPopover>
                      ),
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

            {visibleIndexes.length === 0 && (
              <p className="text-sm text-muted-foreground">No papers in this category yet.</p>
            )}
          </div>
        </div>
      </main>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onDiscard={discard}
        onShowError={
          errorKey
            ? () => {
                setFilter('All')
                window.requestAnimationFrame(() => scrollToItem(`item-${errorKey}`))
              }
            : undefined
        }
      />
    </>
  )
}
