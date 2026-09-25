'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CircleCheck, ExternalLink, LoaderCircle, Plus, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditingBanner } from '@/components/admin/admin-bar'
import { DocumentControl, type DocumentState } from '@/components/admin/document-control'
import {
  AddItemButton,
  EditableItem,
  ItemToolbar,
  SaveBar,
  SettingsField,
  scrollToItem,
  settingsInput,
} from '@/components/admin/editor-ui'
import { OutputHealthBadge } from '@/components/admin/output-health'
import { confirmLeaveWithUnsavedChanges } from '@/components/admin/unsaved-guard'
import { uploadFile } from '@/components/admin/upload'
import { moveItem, newClientKey, useEditorState } from '@/components/admin/use-editor-state'
import { ProjectHeader, ProjectLinks, ProjectSectionView } from '@/components/project-page'
import { checkProjectOutputAction, saveProjectPageAction } from '@/app/admin/editor-actions'
import {
  defaultSections,
  formatAbsoluteDate,
  labelOf,
  linkKinds,
  newSection,
  outputHealth,
  projectSectors,
  sectionTypes,
  summariseOutput,
  updateFrequencies,
  type ProjectLink,
  type ProjectSection,
  type ProjectSectionType,
} from '@/lib/project-meta'
import { slugify, type DocumentChange } from '@/lib/validations'
import type { ProjectOutput } from '@/lib/project-output'
import type { PublicProjectDetail } from '@/lib/public-content'

// /admin/projects/[id]: one project's public page, editable. The header
// is edited in place (same component as the public page); links, live
// data and the document sit in admin panels; each section shows its
// controls above a live preview of how visitors will see it.

export type ProjectPageEditorData = {
  id: number
  slug: string
  title: string
  category: string
  status: string
  kind: string
  date: string
  summary: string
  tags: string[]
  published: boolean
  projectType: string
  mode: string
  languages: string[]
  apis: string[]
  featured: boolean
  links: ProjectLink[]
  outputUrl: string
  embedUrl: string
  updateFrequency: string | null
  sections: ProjectSection[]
  contentType: string
  pdfUrl: string | null
  pdfFilename: string | null
  latexSource: string | null
  output: ProjectOutput | null
  outputCheckedAt: string | null
  outputError: string | null
}

type State = Omit<
  ProjectPageEditorData,
  'id' | 'contentType' | 'pdfUrl' | 'pdfFilename' | 'latexSource' | 'output' | 'outputCheckedAt' | 'outputError'
> & { doc: DocumentState }

function build(data: ProjectPageEditorData): State {
  return {
    slug: data.slug,
    title: data.title,
    category: data.category,
    status: data.status,
    kind: data.kind,
    date: data.date,
    summary: data.summary,
    tags: data.tags,
    published: data.published,
    projectType: data.projectType,
    mode: data.mode,
    languages: data.languages,
    apis: data.apis,
    featured: data.featured,
    links: data.links,
    outputUrl: data.outputUrl,
    embedUrl: data.embedUrl,
    updateFrequency: data.updateFrequency,
    sections: data.sections,
    doc: { kind: 'keep' },
  }
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

const panelClass = 'scroll-mt-28 rounded-2xl border border-border bg-white p-5 font-sans shadow-sm shadow-navy/5'
const panelTitle = 'text-xs font-semibold uppercase tracking-[0.14em] text-steel-700'
const smallButton =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-secondary disabled:opacity-50'

export function ProjectPageEditor({
  data,
  embedOrigins,
  refreshConfigured,
}: {
  data: ProjectPageEditorData
  embedOrigins: string[]
  refreshConfigured: boolean
}) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(data, build)
  const [previewOutput, setPreviewOutput] = useState<ProjectOutput | null>(data.output)
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })

  useEffect(() => setPreviewOutput(data.output), [data.output])

  const errorKey = status.kind === 'error' ? status.clientKey : undefined
  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }))
  const updateSection = (index: number, section: ProjectSection) =>
    setState((s) => ({ ...s, sections: s.sections.map((item, i) => (i === index ? section : item)) }))

  const project: PublicProjectDetail = {
    slug: state.slug,
    title: state.title,
    category: state.category,
    summary: state.summary,
    tags: state.tags,
    status: state.status,
    kind: state.kind as PublicProjectDetail['kind'],
    pdfUrl: data.pdfUrl,
    date: state.date,
    projectType: state.projectType,
    mode: state.mode,
    languages: state.languages,
    apis: state.apis,
    featured: state.featured,
    updateFrequency: state.updateFrequency,
    output: summariseOutput(previewOutput),
    excerpt: state.summary,
    contentType: data.contentType,
    latexSource: data.latexSource,
    pdfFilename: data.pdfFilename,
    links: state.links.filter((link) => /^https:\/\/\S+$/.test(link.url.trim())),
    embedUrl: /^https:\/\/\S+$/.test(state.embedUrl.trim()) ? state.embedUrl.trim() : null,
    sections: state.sections,
    fullOutput: previewOutput,
  }

  async function runCheck() {
    setCheck({ kind: 'checking' })
    try {
      const result = await checkProjectOutputAction(data.id, state.outputUrl)
      if (!result.ok) {
        setCheck({ kind: 'error', message: result.error })
        return
      }
      setPreviewOutput(result.output)
      const when = formatAbsoluteDate(result.output.updatedAt)
      setCheck({
        kind: 'ok',
        message: result.stored
          ? `Fetched and stored — data from ${when} is now on the public pages.`
          : `Valid file (data from ${when}). It's stored when you save.`,
      })
    } catch (error) {
      setCheck({ kind: 'error', message: error instanceof Error ? error.message : 'The check failed.' })
    }
  }

  const save = useCallback(async () => {
    setStatus({ kind: 'saving', message: state.doc.kind === 'file' ? 'Uploading the PDF…' : 'Saving…' })
    try {
      let document: DocumentChange = { kind: 'keep' }
      if (state.doc.kind === 'file') {
        const { key } = await uploadFile(state.doc.file, 'pdf')
        document = { kind: 'upload', key, filename: state.doc.file.name }
      } else if (state.doc.kind === 'latex') {
        document = { kind: 'latex', source: state.doc.source }
      }
      setStatus({ kind: 'saving', message: 'Saving…' })
      const clean = (list: string[]) => list.map((item) => item.trim()).filter(Boolean)
      const result = await saveProjectPageAction({
        id: data.id,
        title: state.title.trim(),
        slug: state.slug.trim(),
        category: state.category.trim(),
        status: state.status,
        kind: state.kind,
        date: state.date,
        summary: state.summary.trim(),
        tags: clean(state.tags),
        published: state.published,
        projectType: state.projectType,
        mode: state.mode,
        languages: clean(state.languages),
        apis: clean(state.apis),
        featured: state.featured,
        document,
        links: state.links.map((link) => ({ ...link, label: link.label.trim(), url: link.url.trim() })),
        outputUrl: state.outputUrl.trim(),
        embedUrl: state.embedUrl.trim(),
        updateFrequency: state.updateFrequency,
        sections: state.sections.map(cleanSection),
      })
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error, clientKey: result.clientKey })
        return
      }
      if (result.output) {
        if (result.output.ok) {
          setPreviewOutput(result.output.value)
          setCheck({ kind: 'ok', message: 'Output fetched and stored with the save.' })
        } else {
          setCheck({ kind: 'error', message: `Saved, but the output file couldn't be used: ${result.output.error}` })
        }
      }
      markSaved(state)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Saving failed.' })
    }
  }, [state, data.id, setStatus, markSaved])

  const embedOrigin = (() => {
    try {
      return state.embedUrl.trim() ? new URL(state.embedUrl.trim()).origin : null
    } catch {
      return null
    }
  })()
  const embedBlocked = embedOrigin !== null && !embedOrigins.includes(embedOrigin)
  const savedHealth = outputHealth({
    outputUrl: data.outputUrl || null,
    output: data.output,
    outputError: data.outputError,
    updateFrequency: data.updateFrequency,
  })

  const addSection = (type: ProjectSectionType) => {
    const id = newClientKey('section')
    setState((s) => ({ ...s, sections: [...s.sections, newSection(type, id)] }))
    window.requestAnimationFrame(() =>
      document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  return (
    <>
      <EditingBanner page="Project page">
        <Link
          href="/admin/projects"
          onClick={(event) => {
            if (!confirmLeaveWithUnsavedChanges()) event.preventDefault()
          }}
          className="font-medium underline-offset-2 hover:underline"
        >
          &larr; All projects
        </Link>
        {data.published && (
          <a
            href={`/projects/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
          >
            Open /projects/{data.slug} <ExternalLink className="size-3" />
          </a>
        )}
      </EditingBanner>

      <main className="pb-32">
        <ProjectHeader
          project={project}
          edit={{
            onChange: (patch) => update(patch),
            sectors: projectSectors,
            linksControl: <LinksEditor links={state.links} onChange={(links) => update({ links })} />,
          }}
        />

        <div className="mx-auto max-w-4xl space-y-6 px-5 sm:px-8">
          <section
            id="item-live-data"
            aria-labelledby="live-data-title"
            className={cn(panelClass, errorKey === 'live-data' && 'ring-2 ring-destructive')}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="live-data-title" className={panelTitle}>
                Live data
              </h2>
              <OutputHealthBadge health={savedHealth} error={data.outputError} />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The project&rsquo;s repository publishes a <code className="text-navy">portfolio-output/1</code> JSON file,
              normally on its GitHub Pages site. The site stores the last valid copy — Key figures and Chart sections
              read from it, and a broken or missing file never breaks the page.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <SettingsField
                  label="Output file URL"
                  hint="e.g. https://iriartet84.github.io/euro-area-nowcast/latest.json — leave empty for a project without live data."
                >
                  <div className="flex gap-2">
                    <input
                      className={settingsInput}
                      value={state.outputUrl}
                      placeholder="https://…/latest.json"
                      inputMode="url"
                      onChange={(event) => update({ outputUrl: event.target.value })}
                    />
                    <button
                      type="button"
                      className={smallButton}
                      disabled={!state.outputUrl.trim() || check.kind === 'checking'}
                      onClick={runCheck}
                    >
                      {check.kind === 'checking' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Check now
                    </button>
                  </div>
                </SettingsField>
              </div>
              <SettingsField label="Update frequency" hint="Shown to visitors; admin flags the data as overdue when it's older than this allows.">
                <select
                  className={settingsInput}
                  value={state.updateFrequency ?? ''}
                  onChange={(event) => update({ updateFrequency: event.target.value || null })}
                >
                  <option value="">Not set</option>
                  {updateFrequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </SettingsField>
              <SettingsField
                label="Embedded app URL"
                hint={
                  embedBlocked ? (
                    <span className="text-amber-700">
                      {embedOrigin} isn&rsquo;t in PROJECT_EMBED_ORIGINS, so browsers will block the frame. Add it to
                      the site&rsquo;s environment variables and redeploy.
                    </span>
                  ) : (
                    'For a Live app section (Shiny, Dash, a JS app…). Loaded only when a visitor clicks.'
                  )
                }
              >
                <input
                  className={settingsInput}
                  value={state.embedUrl}
                  placeholder="https://…"
                  inputMode="url"
                  onChange={(event) => update({ embedUrl: event.target.value })}
                />
              </SettingsField>
            </div>
            <div className="mt-4 space-y-1 text-xs" aria-live="polite">
              {check.kind === 'ok' && (
                <p className="flex items-start gap-1.5 text-emerald-700">
                  <CircleCheck className="mt-px size-3.5 shrink-0" /> {check.message}
                </p>
              )}
              {check.kind === 'error' && (
                <p className="flex items-start gap-1.5 text-destructive">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" /> {check.message}
                </p>
              )}
              {check.kind === 'idle' && data.outputUrl && (
                <p className="text-muted-foreground">
                  {data.output ? `Stored output: data from ${formatAbsoluteDate(data.output.updatedAt)}` : 'No valid output stored yet'}
                  {data.outputCheckedAt ? ` · last checked ${formatAbsoluteDate(data.outputCheckedAt)}` : ''}
                  {data.outputError ? ` · last check failed: ${data.outputError}` : ''}
                </p>
              )}
              {!refreshConfigured && (
                <p className="text-muted-foreground">
                  PROJECT_REFRESH_SECRET isn&rsquo;t set on this site, so project workflows can&rsquo;t notify it
                  after publishing. Outputs are still fetched on save and with Check now.
                </p>
              )}
            </div>
          </section>

          <section
            id="item-document"
            aria-labelledby="page-settings-title"
            className={cn(panelClass, errorKey === 'document' && 'ring-2 ring-destructive')}
          >
            <h2 id="page-settings-title" className={panelTitle}>
              Page &amp; document
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SettingsField
                label="Address (slug)"
                hint={
                  <>
                    /projects/{state.slug || '…'}{' '}
                    <button
                      type="button"
                      className="font-medium text-steel-700 underline-offset-2 hover:underline"
                      onClick={() => update({ slug: slugify(state.title) })}
                    >
                      Generate from title
                    </button>
                  </>
                }
              >
                <input className={settingsInput} value={state.slug} onChange={(event) => update({ slug: event.target.value })} />
              </SettingsField>
              <SettingsField label="Date" hint="Sorts projects in the same position.">
                <input
                  type="date"
                  className={settingsInput}
                  value={state.date}
                  onChange={(event) => event.target.value && update({ date: event.target.value })}
                />
              </SettingsField>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--steel)]"
                  checked={state.published}
                  onChange={(event) => update({ published: event.target.checked })}
                />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--steel)]"
                  checked={state.featured}
                  onChange={(event) => update({ featured: event.target.checked })}
                />
                Featured on Home
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                Document (PDF or LaTeX) — shown by a Document section, or as the whole page when there are no
                sections.
              </span>
              <DocumentControl
                current={{ url: data.pdfUrl, filename: data.pdfFilename, contentType: data.contentType }}
                pending={state.doc}
                latexSource={data.latexSource}
                onChange={(doc) => update({ doc })}
              />
            </div>
          </section>

          <div className="pt-8">
            {state.sections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-steel/30 bg-white p-6 font-sans text-sm">
                <p className="font-medium text-navy">This page has no sections yet.</p>
                <p className="mt-1 text-muted-foreground">
                  Visitors see the original layout: the document if there is one, otherwise an &ldquo;in the
                  works&rdquo; note. Start from the standard layout or add sections one by one below.
                </p>
                <button
                  type="button"
                  className={cn(smallButton, 'mt-4')}
                  onClick={() =>
                    update({
                      sections: [
                        ...defaultSections(),
                        ...(data.pdfUrl ? [newSection('document', newClientKey('section'))] : []),
                      ],
                    })
                  }
                >
                  <Plus className="size-3.5" /> Use the standard layout
                </button>
              </div>
            ) : (
              <div className="space-y-14">
                {state.sections.map((section, index) => (
                  <EditableItem
                    key={section.id}
                    id={`item-${section.id}`}
                    highlighted={errorKey === section.id}
                    toolbarClassName="-top-4 right-3"
                    toolbar={
                      <ItemToolbar
                        itemLabel="section"
                        canMoveBack={index > 0}
                        canMoveForward={index < state.sections.length - 1}
                        onMoveBack={() => update({ sections: moveItem(state.sections, index, index - 1) })}
                        onMoveForward={() => update({ sections: moveItem(state.sections, index, index + 1) })}
                        onRemove={() => update({ sections: state.sections.filter((_, i) => i !== index) })}
                      />
                    }
                  >
                    <SectionEditor
                      section={section}
                      project={project}
                      output={previewOutput}
                      onChange={(next) => updateSection(index, next)}
                    />
                  </EditableItem>
                ))}
              </div>
            )}
            <AddSection onAdd={addSection} />
          </div>
        </div>
      </main>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onDiscard={() => {
          discard()
          setPreviewOutput(data.output)
          setCheck({ kind: 'idle' })
        }}
        onShowError={errorKey ? () => scrollToItem(`item-${errorKey}`) : undefined}
      />
    </>
  )
}

// Empty rows are editing leftovers, not content: drop them before saving.
function cleanSection(section: ProjectSection): ProjectSection {
  switch (section.type) {
    case 'findings':
      return { ...section, items: section.items.map((item) => item.trim()).filter(Boolean) }
    case 'sources':
    case 'downloads':
      return {
        ...section,
        items: section.items
          .map((item) => ({ label: item.label.trim(), url: item.url.trim() }))
          .filter((item) => item.label || item.url),
      } as ProjectSection
    default:
      return section
  }
}

// ---- Links -------------------------------------------------------------------

function LinksEditor({ links, onChange }: { links: ProjectLink[]; onChange: (links: ProjectLink[]) => void }) {
  const set = (index: number, patch: Partial<ProjectLink>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  const valid = links.filter((link) => /^https:\/\/\S+$/.test(link.url.trim()))
  return (
    <div className="rounded-2xl border border-dashed border-steel/30 bg-white/70 p-4 font-sans">
      <p className={panelTitle}>Links</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Buttons under the summary — the repository, the live app, documentation, a dataset…
      </p>
      {links.length > 0 && (
        <ul className="mt-3 space-y-2">
          {links.map((link, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Link type"
                className={cn(settingsInput, 'w-auto')}
                value={link.kind}
                onChange={(event) => set(index, { kind: event.target.value as ProjectLink['kind'] })}
              >
                {linkKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Link label"
                className={cn(settingsInput, 'w-40')}
                value={link.label}
                placeholder={labelOf(linkKinds, link.kind)}
                onChange={(event) => set(index, { label: event.target.value })}
              />
              <input
                aria-label="Link URL"
                className={cn(settingsInput, 'min-w-48 flex-1')}
                value={link.url}
                placeholder="https://…"
                inputMode="url"
                onChange={(event) => set(index, { url: event.target.value })}
              />
              <button
                type="button"
                aria-label="Remove link"
                title="Remove link"
                onClick={() => onChange(links.filter((_, i) => i !== index))}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={cn(smallButton, 'mt-3')}
        onClick={() => onChange([...links, { kind: links.length === 0 ? 'repository' : 'other', label: '', url: '' }])}
      >
        <Plus className="size-3.5" /> Add link
      </button>
      {valid.length > 0 && (
        <div className="mt-4 border-t border-dashed border-border pt-4">
          <ProjectLinks links={valid} />
        </div>
      )}
    </div>
  )
}

// ---- Sections ----------------------------------------------------------------

function AddSection({ onAdd }: { onAdd: (type: ProjectSectionType) => void }) {
  return (
    <div className="mt-10 rounded-2xl border-2 border-dashed border-steel/30 p-5 font-sans">
      <p className="text-sm font-medium text-steel-700">Add a section</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sectionTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            title={type.hint}
            onClick={() => onAdd(type.value)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-steel/40 hover:bg-secondary"
          >
            <Plus className="size-3" />
            {type.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function emptyReason(section: ProjectSection, project: PublicProjectDetail, output: ProjectOutput | null) {
  switch (section.type) {
    case 'figures':
    case 'chart':
      return output
        ? 'Nothing selected matches the output file — hidden from visitors.'
        : 'Waiting for live data: set an output file URL above. Hidden from visitors until then.'
    case 'app':
      return 'No embedded app URL set in Live data — hidden from visitors.'
    case 'document':
      return project.pdfUrl
        ? ''
        : 'No document yet — add a PDF or LaTeX source in Page & document. Hidden from visitors until then.'
    default:
      return 'Empty — hidden from visitors until it has content.'
  }
}

function SectionEditor({
  section,
  project,
  output,
  onChange,
}: {
  section: ProjectSection
  project: PublicProjectDetail
  output: ProjectOutput | null
  onChange: (section: ProjectSection) => void
}) {
  const view = ProjectSectionView({ section, project })
  const typeInfo = sectionTypes.find((type) => type.value === section.type)

  return (
    <div className="rounded-2xl border border-dashed border-steel/30 p-4 sm:p-5">
      <div className="font-sans">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-steel-700">
          {typeInfo?.label} <span className="font-normal normal-case tracking-normal text-muted-foreground">— {typeInfo?.hint}</span>
        </p>
        <div className="mt-3 space-y-3">
          <input
            aria-label="Section heading"
            className={settingsInput}
            value={section.heading}
            placeholder="Heading (optional)"
            onChange={(event) => onChange({ ...section, heading: event.target.value })}
          />
          <SectionControls section={section} output={output} onChange={onChange} />
        </div>
      </div>
      <div className="mt-5 border-t border-dashed border-border pt-5">
        <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preview
        </p>
        {view ?? <p className="font-sans text-sm italic text-muted-foreground">{emptyReason(section, project, output)}</p>}
      </div>
    </div>
  )
}

function Checkbox({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
  children: ReactNode
}) {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-navy', disabled && 'opacity-50')}>
      <input
        type="checkbox"
        className="size-4 accent-[var(--steel)]"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  )
}

function ListRows({
  items,
  onChange,
  withUrl,
  urlOptional,
  addLabel,
}: {
  items: { label: string; url: string }[]
  onChange: (items: { label: string; url: string }[]) => void
  withUrl: boolean
  urlOptional?: boolean
  addLabel: string
}) {
  const set = (index: number, patch: Partial<{ label: string; url: string }>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Label"
            className={cn(settingsInput, 'min-w-40 flex-1')}
            value={item.label}
            placeholder="Label"
            onChange={(event) => set(index, { label: event.target.value })}
          />
          {withUrl && (
            <input
              aria-label="URL"
              className={cn(settingsInput, 'min-w-48 flex-[2]')}
              value={item.url}
              placeholder={urlOptional ? 'https://… (optional)' : 'https://…'}
              inputMode="url"
              onChange={(event) => set(index, { url: event.target.value })}
            />
          )}
          <button
            type="button"
            aria-label="Remove row"
            title="Remove"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" className={smallButton} onClick={() => onChange([...items, { label: '', url: '' }])}>
        <Plus className="size-3.5" /> {addLabel}
      </button>
    </div>
  )
}

function SectionControls({
  section,
  output,
  onChange,
}: {
  section: ProjectSection
  output: ProjectOutput | null
  onChange: (section: ProjectSection) => void
}) {
  switch (section.type) {
    case 'text':
      return (
        <div>
          <textarea
            aria-label="Text (Markdown)"
            className={cn(settingsInput, 'min-h-40 font-mono text-[13px] leading-relaxed')}
            rows={Math.min(30, Math.max(8, section.body.split('\n').length + 2))}
            value={section.body}
            placeholder={'Write in Markdown. For example:\n\nThe model estimates $y_t = \\alpha + \\beta x_t + \\varepsilon_t$ by OLS.\n\n$$\n\\hat\\beta = (X^\\top X)^{-1} X^\\top y\n$$'}
            onChange={(event) => onChange({ ...section, body: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Markdown: **bold**, *italic*, lists, [links](https://…), tables, `code`. Maths: $…$ inline, $$…$$ on its own
            lines. Write \$ for a dollar sign.
          </p>
        </div>
      )
    case 'figures': {
      const all = output?.headline ?? []
      if (all.length === 0) {
        return <p className="text-xs text-muted-foreground">Figures come from the headline list in the output file.</p>
      }
      const allIds = all.map((item) => item.id)
      const selected = section.ids.length ? section.ids : allIds
      const toggle = (id: string) => {
        const set = new Set(selected)
        if (set.has(id)) set.delete(id)
        else set.add(id)
        const next = allIds.filter((item) => set.has(item))
        onChange({ ...section, ids: next.length === allIds.length ? [] : next })
      }
      return (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {all.map((item) => (
            <Checkbox key={item.id} checked={selected.includes(item.id)} onChange={() => toggle(item.id)}>
              {item.label}
            </Checkbox>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-2">All figures are shown when all are ticked, including ones added to the file later.</p>
        </div>
      )
    }
    case 'chart': {
      const all = output?.series ?? []
      const allIds = all.map((s) => s.id)
      const toggle = (id: string) => {
        const set = new Set(section.seriesIds)
        if (set.has(id)) set.delete(id)
        else set.add(id)
        onChange({ ...section, seriesIds: allIds.filter((item) => set.has(item)) })
      }
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Chart type"
              className={cn(settingsInput, 'w-auto')}
              value={section.kind}
              onChange={(event) => onChange({ ...section, kind: event.target.value as 'line' | 'bar' })}
            >
              <option value="line">Line chart</option>
              <option value="bar">Bar chart</option>
            </select>
          </div>
          {all.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {all.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={section.seriesIds.includes(s.id)}
                  disabled={!section.seriesIds.includes(s.id) && section.seriesIds.length >= 4}
                  onChange={() => toggle(s.id)}
                >
                  {s.label}
                  {s.unit ? ` (${s.unit})` : ''}
                </Checkbox>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Up to 4 series on one axis. None ticked shows the first series.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Series come from the output file.</p>
          )}
          <input
            aria-label="Chart note"
            className={settingsInput}
            value={section.note}
            placeholder="Note under the chart (source, definitions…) — optional"
            onChange={(event) => onChange({ ...section, note: event.target.value })}
          />
        </div>
      )
    }
    case 'app':
      return (
        <SettingsField label="Frame height (pixels)">
          <input
            type="number"
            min={300}
            max={1600}
            step={20}
            className={cn(settingsInput, 'w-32')}
            value={section.height}
            onChange={(event) => {
              const height = Math.round(Number(event.target.value))
              if (Number.isFinite(height)) onChange({ ...section, height: Math.max(300, Math.min(1600, height)) })
            }}
          />
        </SettingsField>
      )
    case 'findings':
      return (
        <div className="space-y-2">
          {section.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <textarea
                aria-label={`Finding ${index + 1}`}
                rows={2}
                className={cn(settingsInput, 'flex-1')}
                value={item}
                placeholder="A key result, in a sentence or two"
                onChange={(event) =>
                  onChange({ ...section, items: section.items.map((it, i) => (i === index ? event.target.value : it)) })
                }
              />
              <button
                type="button"
                aria-label="Remove finding"
                title="Remove"
                onClick={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}
                className="mt-1 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button type="button" className={smallButton} onClick={() => onChange({ ...section, items: [...section.items, ''] })}>
            <Plus className="size-3.5" /> Add finding
          </button>
        </div>
      )
    case 'sources':
      return (
        <ListRows
          items={section.items}
          withUrl
          urlOptional
          addLabel="Add source"
          onChange={(items) => onChange({ ...section, items })}
        />
      )
    case 'downloads':
      return (
        <div className="space-y-2">
          <ListRows items={section.items} withUrl addLabel="Add download" onChange={(items) => onChange({ ...section, items })} />
          <p className="text-xs text-muted-foreground">Downloads listed in the output file are added automatically.</p>
        </div>
      )
    case 'document':
      return <p className="text-xs text-muted-foreground">Shows the document set in Page &amp; document.</p>
  }
}
