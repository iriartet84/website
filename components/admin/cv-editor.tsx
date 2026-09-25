'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Download, ExternalLink, Plus, RotateCcw, Settings2, Trash2, Upload } from 'lucide-react'
import { CvView } from '@/components/cv-view'
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
import { fileUrl, uploadFile, validateFile } from '@/components/admin/upload'
import { focusItem, moveItem, newClientKey, useEditorState } from '@/components/admin/use-editor-state'
import { saveCvPageAction } from '@/app/admin/editor-actions'
import type { CvPdfChange } from '@/lib/validations'
import type { SkillGroup } from '@/lib/queries'

// /admin/cv: the public CV page rendered with the same component
// (components/cv-view.tsx), in edit mode — including the "Download CV"
// button, which is where the CV PDF is uploaded, replaced or removed.

type Profile = {
  tagline: string
  nationality: string
  location: string
  email: string
  phone: string
  linkedin: string
  linkedinUrl: string
  skillGroups: SkillGroup[]
}

type ExperienceFields = {
  org: string
  role: string
  location: string
  period: string
  summary: string
  details: string[]
}
type EducationFields = {
  school: string
  location: string
  degree: string
  period: string
  details: string[]
}
type LanguageFields = { name: string; level: string }

type Saved<T> = T & { id: number; published: boolean }

export type CvEditorData = {
  fullName: string
  loadError: boolean
  profile: Profile
  cvPdf: { key: string; filename: string } | null
  experience: Saved<ExperienceFields>[]
  education: Saved<EducationFields>[]
  languages: Saved<LanguageFields>[]
  defaults: {
    experience: ExperienceFields[]
    education: EducationFields[]
    languages: LanguageFields[]
  }
}

type Row<T> = T & { clientKey: string; id: number | null; published: boolean; removed: boolean }

type PdfState = { kind: 'keep' } | { kind: 'file'; file: File } | { kind: 'remove' }

type State = {
  profile: Profile
  pdf: PdfState
  experience: Row<ExperienceFields>[]
  education: Row<EducationFields>[]
  languages: Row<LanguageFields>[]
}

function rowsFrom<T>(saved: Saved<T>[], defaults: T[], prefix: string, loadError: boolean): Row<T>[] {
  if (saved.length > 0 || loadError) {
    return saved.map((row) => ({ ...row, clientKey: `${prefix}-${row.id}`, removed: false }))
  }
  // Nothing saved yet: the public page shows the built-in entries, so the
  // editor starts from them too (saving stores them).
  return defaults.map((row, index) => ({
    ...row,
    clientKey: `default-${prefix}-${index}`,
    id: null,
    published: true,
    removed: false,
  }))
}

function build(data: CvEditorData): State {
  return {
    profile: data.profile,
    pdf: { kind: 'keep' },
    experience: rowsFrom(data.experience, data.defaults.experience, 'experience', data.loadError),
    education: rowsFrom(data.education, data.defaults.education, 'education', data.loadError),
    languages: rowsFrom(data.languages, data.defaults.languages, 'language', data.loadError),
  }
}

type ListName = 'experience' | 'education' | 'languages'

export function CvEditor({ data }: { data: CvEditorData }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(data, build)
  const errorKey = status.kind === 'error' ? status.clientKey : undefined

  const setProfile = (patch: Partial<Profile>) =>
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }))

  // Generic list handling shared by the three CV sections.
  function listEdit<T extends object>(
    name: ListName,
    noun: string,
    blank: T,
    labelOf: (row: T) => string,
    direction: 'vertical' | 'horizontal' = 'vertical',
  ) {
    const rows = state[name] as unknown as Row<T>[]
    const setRows = (update: (rows: Row<T>[]) => Row<T>[]) =>
      setState((s) => ({ ...s, [name]: update(s[name] as unknown as Row<T>[]) }))
    const updateRow = (clientKey: string, patch: Partial<Row<T>>) =>
      setRows((list) => list.map((row) => (row.clientKey === clientKey ? { ...row, ...patch } : row)))

    const unsavedHidden = rows.length > 0 && !rows.some((row) => row.published && !row.removed)

    return {
      onItemChange: (index: number, patch: Partial<T>) => updateRow(rows[index].clientKey, patch as Partial<Row<T>>),
      wrapItem: (index: number, entry: ReactNode) => {
        const row = rows[index]
        if (row.removed) {
          return (
            <RemovedItem
              label={labelOf(row) ? `“${labelOf(row)}”` : `This ${noun}`}
              onUndo={() => updateRow(row.clientKey, { removed: false } as Partial<Row<T>>)}
            />
          )
        }
        return (
          <EditableItem
            id={`item-${row.clientKey}`}
            published={row.published}
            isNew={row.id === null}
            highlighted={errorKey === row.clientKey}
            // Vertical entries keep their toolbar in the empty space left of
            // the entry on wider screens, clear of the dates on the right.
            toolbarClassName={
              direction === 'vertical'
                ? '-top-5 right-0 md:top-0 md:right-full md:mr-4 md:flex-col md:items-end'
                : '-top-4 right-1'
            }
            toolbar={
              <ItemToolbar
                itemLabel={noun}
                direction={direction}
                className={direction === 'vertical' ? 'md:flex-col' : undefined}
                canMoveBack={index > 0}
                canMoveForward={index < rows.length - 1}
                onMoveBack={() => setRows((list) => moveItem(list, index, index - 1))}
                onMoveForward={() => setRows((list) => moveItem(list, index, index + 1))}
                published={row.published}
                onTogglePublished={() => updateRow(row.clientKey, { published: !row.published } as Partial<Row<T>>)}
                onRemove={() =>
                  row.id === null
                    ? setRows((list) => list.filter((r) => r.clientKey !== row.clientKey))
                    : updateRow(row.clientKey, { removed: true } as Partial<Row<T>>)
                }
              />
            }
          >
            {entry}
          </EditableItem>
        )
      },
      after: (
        <>
          {unsavedHidden && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Every {noun} here is hidden — visitors will see the built-in {noun} entries instead until at
              least one is published.
            </p>
          )}
          <AddItemButton
            className={direction === 'horizontal' ? 'h-full min-h-20 py-3' : 'py-4'}
            onClick={() => {
              const clientKey = newClientKey(name)
              setRows((list) => [
                ...list,
                { ...blank, clientKey, id: null, published: true, removed: false } as Row<T>,
              ])
              focusItem(`item-${clientKey}`)
            }}
          >
            <Plus className="size-4" />
            Add {noun}
          </AddItemButton>
        </>
      ),
    }
  }

  const save = useCallback(async () => {
    setStatus({ kind: 'saving', message: state.pdf.kind === 'file' ? 'Uploading the CV PDF…' : 'Saving…' })
    try {
      let cvPdf: CvPdfChange = { kind: 'keep' }
      if (state.pdf.kind === 'file') {
        const { key } = await uploadFile(state.pdf.file, 'pdf')
        cvPdf = { kind: 'upload', key, filename: state.pdf.file.name }
      } else if (state.pdf.kind === 'remove') {
        cvPdf = { kind: 'remove' }
      }
      setStatus({ kind: 'saving', message: 'Saving…' })

      const list = <T extends object>(rows: Row<T>[], clean: (row: Row<T>) => object) => ({
        items: rows.filter((row) => !row.removed).map((row) => ({
          clientKey: row.clientKey,
          id: row.id,
          published: row.published,
          ...clean(row),
        })),
        deletedIds: rows.filter((row) => row.removed && row.id !== null).map((row) => row.id as number),
      })
      const bullets = (details: string[]) => details.map((d) => d.trim()).filter(Boolean)

      const result = await saveCvPageAction({
        profile: {
          ...state.profile,
          skillGroups: state.profile.skillGroups
            .map((group) => ({ ...group, label: group.label.trim(), tags: group.tags.map((s) => s.trim()).filter(Boolean) }))
            .filter((group) => group.label),
        },
        cvPdf,
        experience: list(state.experience, (row) => ({
          org: row.org,
          role: row.role,
          location: row.location,
          period: row.period,
          summary: row.summary,
          details: bullets(row.details),
        })),
        education: list(state.education, (row) => ({
          school: row.school,
          location: row.location,
          degree: row.degree,
          period: row.period,
          details: bullets(row.details),
        })),
        languages: list(state.languages, (row) => ({ name: row.name, level: row.level })),
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

  const cvPdfUrl = data.cvPdf ? fileUrl(data.cvPdf.key, { download: true, filename: data.cvPdf.filename }) : null

  return (
    <>
      <EditingBanner page="CV">
        <a href="/cv" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          Open /cv <ExternalLink className="size-3" />
        </a>
      </EditingBanner>

      {data.loadError && (
        <p className="mx-auto mt-6 max-w-6xl rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-8 lg:mx-auto">
          Some CV entries couldn&rsquo;t be loaded from the database. Saving now would only update the
          sections that loaded.
        </p>
      )}

      <div className="pb-32">
        <CvView
          fullName={data.fullName}
          cv={{ ...state.profile, cvPdfUrl }}
          education={state.education}
          experience={state.experience}
          languages={state.languages}
          edit={{
            onProfileChange: setProfile,
            contactSettings: (
              <SettingsPopover
                title="Contact settings"
                triggerLabel="Contact settings"
                trigger={
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-steel/40 px-2.5 py-1 text-xs font-medium text-steel-700 hover:border-steel">
                    <Settings2 className="size-3" />
                    Links &amp; phone
                  </span>
                }
              >
                <SettingsField label="LinkedIn URL" hint="Where the LinkedIn link above points.">
                  <input
                    className={settingsInput}
                    value={state.profile.linkedinUrl}
                    placeholder="https://linkedin.com/in/…"
                    onChange={(event) => setProfile({ linkedinUrl: event.target.value })}
                  />
                </SettingsField>
                <SettingsField label="Phone" hint="Stored with the CV; not shown on this page.">
                  <input
                    className={settingsInput}
                    value={state.profile.phone}
                    onChange={(event) => setProfile({ phone: event.target.value })}
                  />
                </SettingsField>
              </SettingsPopover>
            ),
            downloadControl: (
              <CvDownloadControl
                current={data.cvPdf ? { url: cvPdfUrl!, filename: data.cvPdf.filename } : null}
                pending={state.pdf}
                highlighted={errorKey === 'cv-pdf'}
                onChange={(pdf) => setState((s) => ({ ...s, pdf }))}
              />
            ),
            education: listEdit<EducationFields>(
              'education',
              'education entry',
              { school: '', location: '', degree: '', period: '', details: [''] },
              (row) => row.school,
            ),
            experience: listEdit<ExperienceFields>(
              'experience',
              'experience entry',
              { org: '', role: '', location: '', period: '', summary: '', details: [''] },
              (row) => row.org,
            ),
            languages: listEdit<LanguageFields>(
              'languages',
              'language',
              { name: '', level: '' },
              (row) => row.name,
              'horizontal',
            ),
          }}
        />
      </div>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onDiscard={discard}
        onShowError={errorKey ? () => scrollToItem(errorKey === 'cv-pdf' ? 'cv-pdf' : `item-${errorKey}`) : undefined}
      />
    </>
  )
}

// The "Download CV" button in its place on the page, plus what you can do
// with it. Visitors only see the button while a PDF is uploaded; clicking it
// gets them a short-lived presigned download link to the private bucket.
function CvDownloadControl({
  current,
  pending,
  highlighted,
  onChange,
}: {
  current: { url: string; filename: string } | null
  pending: PdfState
  highlighted: boolean
  onChange: (next: PdfState) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const pill =
    'inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-800'
  const action = 'inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:text-navy'

  let note: ReactNode
  if (pending.kind === 'file') note = <>{pending.file.name} — uploads on save</>
  else if (pending.kind === 'remove') note = <>Button hidden from visitors after saving</>
  else if (current) note = <>{current.filename}</>
  else note = <>No PDF yet — visitors don&rsquo;t see this button</>

  return (
    <span
      id="cv-pdf"
      className={`inline-flex scroll-mt-28 flex-wrap items-center justify-end gap-x-3 gap-y-1 rounded-2xl ${highlighted ? 'ring-2 ring-destructive ring-offset-4' : ''}`}
    >
      <span className="text-xs text-muted-foreground">{note}</span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const problem = validateFile(file, 'pdf')
          setError(problem)
          if (!problem) onChange({ kind: 'file', file })
        }}
      />
      <button type="button" className={action} onClick={() => inputRef.current?.click()}>
        <Upload className="size-3" />
        {current || pending.kind === 'file' ? 'Replace PDF' : 'Upload PDF'}
      </button>
      {current && pending.kind === 'keep' && (
        <button type="button" className={`${action} hover:text-destructive`} onClick={() => onChange({ kind: 'remove' })}>
          <Trash2 className="size-3" />
          Remove
        </button>
      )}
      {pending.kind !== 'keep' && (
        <button type="button" className={action} onClick={() => onChange({ kind: 'keep' })}>
          <RotateCcw className="size-3" />
          Undo
        </button>
      )}
      {pending.kind === 'remove' || (!current && pending.kind === 'keep') ? (
        <span className={`${pill} border border-dashed border-navy/40 bg-transparent text-navy/50 hover:bg-transparent`}>
          <Download className="size-3.5" />
          Download CV
        </span>
      ) : current && pending.kind === 'keep' ? (
        <a href={current.url} className={pill} title="Download the current CV (as visitors would)">
          <Download className="size-3.5" />
          Download CV
        </a>
      ) : (
        <span className={pill}>
          <Download className="size-3.5" />
          Download CV
        </span>
      )}
      {error && <span className="basis-full text-right text-xs text-destructive">{error}</span>}
    </span>
  )
}
