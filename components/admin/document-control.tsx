'use client'

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  Bold,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns2,
  Eye,
  FileCode2,
  FileText,
  FileUp,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  LoaderCircle,
  RotateCcw,
  Sigma,
  SquareSigma,
  Superscript,
  Table2,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LatexArticleView } from '@/components/latex-article-view'
import { uploadFile, validateFile } from '@/components/admin/upload'
import { renderLatexPreviewAction } from '@/app/admin/editor-actions'
import type { RenderedArticle } from '@/lib/latex-article'
import type { AttachedPdfChange, DocumentChange } from '@/lib/validations'

// The document behind a paper or project, edited in a console that opens
// below the entry (not a popup). A document is either:
// - a PDF, shown in the page's PDF reader; or
// - LaTeX, shown as an article on the page (lib/latex-article.ts), with the
//   images it uses uploaded from here and, optionally, a PDF attached for a
//   "Download PDF" button.
// Everything stays a local draft until the page is saved; only images are
// uploaded straight away, since the source needs their addresses.

export type PdfDraft = { kind: 'keep' } | { kind: 'file'; file: File } | { kind: 'remove' }
export type DocumentDraft = { mode: 'pdf' | 'latex'; source: string; pdf: PdfDraft }
export type CurrentDocument = {
  contentType: string
  latexSource: string | null
  pdfUrl: string | null
  pdfFilename: string | null
}

export function initialDocumentDraft(current: CurrentDocument): DocumentDraft {
  return {
    mode: current.contentType === 'latex' && current.latexSource ? 'latex' : 'pdf',
    source: current.latexSource ?? '',
    pdf: { kind: 'keep' },
  }
}

function isUnchanged(draft: DocumentDraft, current: CurrentDocument) {
  const initial = initialDocumentDraft(current)
  return draft.mode === initial.mode && draft.source === initial.source && draft.pdf.kind === 'keep'
}

// The save payload for a draft; a picked PDF is uploaded here, straight to
// storage.
export async function documentChangeFor(draft: DocumentDraft, current: CurrentDocument): Promise<DocumentChange> {
  if (isUnchanged(draft, current)) return { kind: 'keep' }
  let pdf: AttachedPdfChange = { kind: 'keep' }
  if (draft.pdf.kind === 'file') {
    const { key } = await uploadFile(draft.pdf.file, 'pdf')
    pdf = { kind: 'upload', key, filename: draft.pdf.file.name }
  } else if (draft.pdf.kind === 'remove') {
    pdf = { kind: 'remove' }
  }
  return draft.mode === 'latex' ? { kind: 'latex', source: draft.source, pdf } : { kind: 'pdf', pdf }
}

// ---- The line on the entry itself ----------------------------------------------

export function DocumentSummary({
  current,
  draft,
  open,
  onToggle,
}: {
  current: CurrentDocument
  draft: DocumentDraft
  open: boolean
  onToggle: () => void
}) {
  let label: ReactNode
  if (draft.mode === 'latex') {
    label = (
      <>
        <FileCode2 aria-hidden className="size-4 text-steel" />
        LaTeX article
      </>
    )
  } else {
    const name =
      draft.pdf.kind === 'file'
        ? draft.pdf.file.name
        : draft.pdf.kind === 'remove' || !current.pdfUrl
          ? null
          : current.pdfFilename ?? 'PDF'
    label = name ? (
      <>
        <FileText aria-hidden className="size-4 text-steel" />
        <span className="max-w-[14rem] truncate">{name}</span>
      </>
    ) : (
      <span className="font-normal text-muted-foreground">No document yet</span>
    )
  }
  const changed = !isUnchanged(draft, current)

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 font-sans">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
        {label}
        {changed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">unsaved</span>}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-steel/30 bg-white px-3 py-1 text-sm font-semibold text-steel-700 transition-colors hover:border-steel hover:text-navy"
      >
        {open ? 'Close document' : 'Edit document'}
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
    </span>
  )
}

// ---- The console ---------------------------------------------------------------

const toolButton =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-navy transition-colors hover:bg-secondary disabled:opacity-40'

type Snippet = { text: string; select?: [number, number] }

export function DocumentConsole({
  current,
  draft,
  onChange,
  onClose,
  className,
  pageFields,
}: {
  current: CurrentDocument
  draft: DocumentDraft
  onChange: (draft: DocumentDraft) => void
  onClose?: () => void
  className?: string
  // Fields for the entry's page that aren't part of the document (a paper's
  // Long Abstract), shown above the document controls.
  pageFields?: ReactNode
}) {
  const draftRef = useRef(draft)
  draftRef.current = draft
  const sectionRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const texInputRef = useRef<HTMLInputElement>(null)

  const [view, setView] = useState<'code' | 'split' | 'preview'>('split')
  const [preview, setPreview] = useState<RenderedArticle | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'error'; undo?: string } | null>(null)

  const update = (patch: Partial<DocumentDraft>) => onChange({ ...draftRef.current, ...patch })
  const setSource = (source: string) => update({ source })

  // Phones start on the code; wider screens show code and preview side by
  // side. The console scrolls into view when it opens.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setView('code')
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Live preview (and its notes), rendered by the server exactly as the
  // public page will be.
  useEffect(() => {
    if (draft.mode !== 'latex') return
    const source = draft.source
    if (!source.trim()) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    setPreviewing(true)
    const timer = window.setTimeout(async () => {
      const result = await renderLatexPreviewAction(source).catch(() => ({ ok: false as const, error: 'The preview could not be rendered.' }))
      if (draftRef.current.source !== source) return
      setPreviewing(false)
      if (result.ok) {
        setPreview(result.article)
        setPreviewError(null)
      } else {
        setPreviewError(result.error)
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [draft.source, draft.mode])

  // Replaces the selection with a snippet built from it.
  const insert = (build: (selected: string) => Snippet, block = false) => {
    const textarea = textareaRef.current
    const source = draftRef.current.source
    const start = textarea?.selectionStart ?? source.length
    const end = textarea?.selectionEnd ?? source.length
    let { text, select } = build(source.slice(start, end))
    if (block) {
      const before = source.slice(0, start)
      const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
      const after = source.slice(end)
      const trail = after.startsWith('\n') ? '\n' : '\n\n'
      text = `${lead}${text}${trail}`
      if (select) select = [select[0] + lead.length, select[1] + lead.length]
    }
    setSource(source.slice(0, start) + text + source.slice(end))
    window.requestAnimationFrame(() => {
      if (!textarea) return
      textarea.focus()
      const [from, to] = select ?? [text.length, text.length]
      textarea.setSelectionRange(start + from, start + to)
    })
  }

  const wrap = (open: string, close: string, placeholder: string) => (selected: string): Snippet => {
    const inner = selected || placeholder
    return { text: `${open}${inner}${close}`, select: [open.length, open.length + inner.length] }
  }

  const tools: { label: string; icon: typeof Bold; run: () => void; wide?: boolean }[] = [
    { label: 'Section', icon: Heading2, run: () => insert(wrap('\\section{', '}', 'Section title'), true) },
    { label: 'Subsection', icon: Heading3, run: () => insert(wrap('\\subsection{', '}', 'Subsection title'), true) },
    { label: 'Bold', icon: Bold, run: () => insert(wrap('\\textbf{', '}', 'bold text')) },
    { label: 'Italic', icon: Italic, run: () => insert(wrap('\\emph{', '}', 'emphasis')) },
    { label: 'Inline maths', icon: Sigma, run: () => insert(wrap('$', '$', 'x^2')) },
    {
      label: 'Equation',
      icon: SquareSigma,
      run: () =>
        insert((selected) => {
          const body = selected || 'y = \\alpha + \\beta x'
          const text = `\\begin{equation}\n  ${body}\n  \\label{eq:}\n\\end{equation}`
          return { text, select: [19, 19 + body.length] }
        }, true),
    },
    {
      label: 'List',
      icon: List,
      run: () =>
        insert((selected) => {
          const items = (selected || 'First point\nSecond point').split('\n').filter((line) => line.trim())
          const text = `\\begin{itemize}\n${items.map((item) => `  \\item ${item.trim()}`).join('\n')}\n\\end{itemize}`
          return { text }
        }, true),
    },
    {
      label: 'Table',
      icon: Table2,
      run: () =>
        insert(
          () => ({
            text:
              '\\begin{table}[h]\n  \\centering\n  \\caption{Table title}\n  \\label{tab:}\n  \\begin{tabular}{lrr}\n    \\toprule\n    Country & 2023 & 2024 \\\\\n    \\midrule\n    Chile & 44.0 & 48.2 \\\\\n    Argentina & 9.6 & 11.3 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}',
            select: [41, 52],
          }),
          true,
        ),
    },
    { label: 'Footnote', icon: Superscript, run: () => insert(wrap('\\footnote{', '}', 'Footnote text')) },
    {
      label: 'Link',
      icon: Link2,
      run: () =>
        insert((selected) => {
          const text = `\\href{https://}{${selected || 'link text'}}`
          return { text, select: [6, 14] }
        }),
    },
  ]

  // Uploads images now (the source needs their address). An image whose
  // file name matches an \includegraphics already in the source replaces
  // that reference (so a pasted paper's figures can be linked one by one);
  // otherwise a figure is inserted at the cursor.
  const addImages = async (files: File[]) => {
    for (const file of files) {
      const problem = validateFile(file, 'image')
      if (problem) {
        setNotice({ text: `${file.name}: ${problem}`, tone: 'error' })
        continue
      }
      setBusy(`Uploading ${file.name}…`)
      let key: string
      try {
        ;({ key } = await uploadFile(file, 'image'))
      } catch (error) {
        setBusy(null)
        setNotice({ text: error instanceof Error ? error.message : `Uploading ${file.name} failed.`, tone: 'error' })
        continue
      }
      setBusy(null)
      const url = `/api/files/${key}`
      const base = file.name.replace(/\.[^.]+$/, '').toLowerCase()
      const source = draftRef.current.source
      let linked = 0
      const next = source.replace(/\\includegraphics(\s*\[[^\]]*\])?\s*\{([^}]*)\}/g, (match, options = '', path: string) => {
        const name = path.trim().split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase()
        if (name !== base || path.trim().startsWith('/api/files/')) return match
        linked += 1
        return `\\includegraphics${options}{${url}}`
      })
      if (linked > 0) {
        setSource(next)
        setNotice({
          text: `Linked ${file.name} to ${linked} existing image reference${linked > 1 ? 's' : ''}.`,
          tone: 'info',
          undo: source,
        })
      } else {
        const caption = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
        const label = base.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'figure'
        insert(
          () => {
            const text = `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.85\\linewidth]{${url}}\n  \\caption{${caption}}\n  \\label{fig:${label}}\n\\end{figure}`
            const at = text.indexOf('\\caption{') + 9
            return { text, select: [at, at + caption.length] }
          },
          true,
        )
        setNotice({ text: `Inserted ${file.name} as a figure — edit its caption.`, tone: 'info' })
      }
    }
  }

  const loadTexFile = async (file: File) => {
    if (file.size > 400_000) {
      setNotice({ text: `${file.name} is too large for the editor.`, tone: 'error' })
      return
    }
    const text = await file.text()
    const previous = draftRef.current.source
    setSource(text)
    setNotice({ text: `Loaded ${file.name}.`, tone: 'info', undo: previous.trim() ? previous : undefined })
  }

  const onEditorDrop = (event: DragEvent) => {
    const files = [...event.dataTransfer.files]
    if (files.length === 0) return
    event.preventDefault()
    const tex = files.find((file) => /\.(tex|txt)$/i.test(file.name))
    if (tex) void loadTexFile(tex)
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length) void addImages(images)
  }

  const notes = preview?.warnings ?? []
  const imageCount = preview?.images.length ?? 0
  const missingImages = notes.filter((note) => note.startsWith('Image ')).length

  return (
    <section ref={sectionRef} className={cn('scroll-mt-24 overflow-hidden rounded-2xl border border-steel/25 bg-white font-sans shadow-sm shadow-navy/5', className)} aria-label="Document">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-secondary/60 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-700">Document</span>
        <div role="radiogroup" aria-label="Document type" className="inline-flex rounded-full bg-white p-0.5 ring-1 ring-border">
          {(
            [
              ['pdf', 'PDF', FileText],
              ['latex', 'LaTeX article', FileCode2],
            ] as const
          ).map(([mode, label, Icon]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={draft.mode === mode}
              onClick={() => update({ mode })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                draft.mode === mode ? 'bg-navy text-white' : 'text-navy hover:bg-secondary',
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {draft.mode === 'pdf'
            ? 'Readers see the PDF in the page’s reader.'
            : 'Readers see the LaTeX as an article on the page.'}
        </span>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-navy hover:bg-white">
            Done <ChevronUp className="size-3.5" />
          </button>
        )}
      </header>

      {pageFields && <div className="border-b border-border px-4 py-4 sm:px-5">{pageFields}</div>}

      {draft.mode === 'pdf' ? (
        <div className="p-4 sm:p-5">
          <PdfDrop
            current={current}
            pending={draft.pdf}
            onChange={(pdf) => update({ pdf })}
            large
            empty="No PDF yet"
          />
          {current.contentType === 'latex' && current.latexSource && (
            <p className="mt-3 text-xs text-muted-foreground">
              The LaTeX source stays saved — switch back to &ldquo;LaTeX article&rdquo; any time.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
            <button type="button" className={toolButton} onClick={() => texInputRef.current?.click()} title="Load a .tex file into the editor">
              <Upload className="size-3.5" /> Load .tex
            </button>
            <button type="button" className={toolButton} onClick={() => imageInputRef.current?.click()} disabled={busy !== null} title="Upload images (PNG, JPEG, WebP, GIF)">
              <ImagePlus className="size-3.5" /> Image
            </button>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            {tools.map((tool) => (
              <button key={tool.label} type="button" className={cn(toolButton, 'px-1.5')} onClick={tool.run} title={tool.label} aria-label={tool.label}>
                <tool.icon className="size-4" />
              </button>
            ))}
            <div role="radiogroup" aria-label="View" className="ml-auto inline-flex rounded-md bg-secondary p-0.5">
              {(
                [
                  ['code', 'Code', Code2],
                  ['split', 'Split', Columns2],
                  ['preview', 'Preview', Eye],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                    view === value ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground hover:text-navy',
                    value === 'split' && 'hidden md:inline-flex',
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])]
                event.target.value = ''
                if (files.length) void addImages(files)
              }}
            />
            <input
              ref={texInputRef}
              type="file"
              accept=".tex,.txt,text/x-tex,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void loadTexFile(file)
              }}
            />
          </div>

          <div className={cn('grid', view === 'split' && 'md:grid-cols-2')}>
            {view !== 'preview' && (
              <textarea
                ref={textareaRef}
                value={draft.source}
                onChange={(event) => setSource(event.target.value)}
                onDragOver={(event) => event.dataTransfer.types.includes('Files') && event.preventDefault()}
                onDrop={onEditorDrop}
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && !event.shiftKey) {
                    event.preventDefault()
                    insert(() => ({ text: '  ' }))
                  }
                }}
                spellCheck={false}
                aria-label="LaTeX source"
                placeholder={'Paste your LaTeX here — a whole paper (\\documentclass … \\end{document}) or just the body.\n\nDrop .tex files and images onto this box, or use the buttons above.'}
                className="h-[32rem] w-full resize-y border-0 bg-[oklch(0.985_0.003_258)] p-4 font-mono text-[13px] leading-6 text-navy outline-none placeholder:text-muted-foreground/70 focus:bg-white"
              />
            )}
            {view !== 'code' && (
              <div className={cn('relative h-[32rem] overflow-y-auto bg-white px-6 py-5', view === 'split' && 'md:border-l md:border-border')}>
                {previewing && (
                  <span className="sticky top-0 float-right inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm">
                    <LoaderCircle className="size-3 animate-spin" /> Updating
                  </span>
                )}
                {previewError ? (
                  <p className="text-sm text-destructive">{previewError}</p>
                ) : preview ? (
                  <LatexArticleView article={preview} showTitle />
                ) : (
                  <p className="text-sm text-muted-foreground">The article preview appears here as you type.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{draft.source.length.toLocaleString('en-GB')} characters</span>
            <span className="tabular-nums">
              {imageCount} image{imageCount === 1 ? '' : 's'}
              {missingImages > 0 && <span className="text-amber-700"> · {missingImages} not uploaded</span>}
            </span>
            {notes.length > 0 && (
              <button type="button" onClick={() => setShowNotes((v) => !v)} className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-900" aria-expanded={showNotes}>
                <TriangleAlert className="size-3.5" />
                {notes.length} note{notes.length > 1 ? 's' : ''} on the source
                {showNotes ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            )}
            {busy && (
              <span className="inline-flex items-center gap-1 text-navy">
                <LoaderCircle className="size-3 animate-spin" /> {busy}
              </span>
            )}
            {notice && (
              <span className={cn('inline-flex items-center gap-2', notice.tone === 'error' ? 'text-destructive' : 'text-emerald-700')}>
                {notice.text}
                {notice.undo !== undefined && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 font-medium text-navy hover:underline"
                    onClick={() => {
                      setSource(notice.undo ?? '')
                      setNotice(null)
                    }}
                  >
                    <RotateCcw className="size-3" /> Undo
                  </button>
                )}
              </span>
            )}
          </div>
          {showNotes && notes.length > 0 && (
            <ul className="space-y-1 border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              {notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span aria-hidden>•</span>
                  {note}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-navy">PDF for downloading (optional)</p>
              <p className="text-xs text-muted-foreground">
                Readers get a &ldquo;Download PDF&rdquo; button with this file. Without one, they can save the
                article as a PDF from their browser.
              </p>
            </div>
            <PdfDrop current={current} pending={draft.pdf} onChange={(pdf) => update({ pdf })} empty="No PDF attached" />
          </div>
        </>
      )}
    </section>
  )
}

// Current / pending PDF with upload, replace, remove and undo — as a large
// drop zone (PDF documents) or a compact row (a LaTeX article's download).
function PdfDrop({
  current,
  pending,
  onChange,
  large = false,
  empty,
}: {
  current: CurrentDocument
  pending: PdfDraft
  onChange: (pdf: PdfDraft) => void
  large?: boolean
  empty: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const pick = (file: File | undefined) => {
    if (!file) return
    const problem = validateFile(file, 'pdf')
    setError(problem)
    if (!problem) onChange({ kind: 'file', file })
  }

  const link = 'inline-flex items-center gap-1 text-xs font-semibold text-steel-700 transition-colors hover:text-navy'
  let status: ReactNode
  if (pending.kind === 'file') {
    status = (
      <>
        <span className="font-semibold text-navy">{pending.file.name}</span> — uploads when you save
      </>
    )
  } else if (pending.kind === 'remove') {
    status = <>Removed when you save</>
  } else if (current.pdfUrl) {
    status = (
      <a href={current.pdfUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy underline-offset-2 hover:underline">
        {current.pdfFilename ?? 'Current PDF'}
      </a>
    )
  } else {
    status = <>{empty}</>
  }

  const controls = (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" className={link} onClick={() => inputRef.current?.click()}>
        <FileUp className="size-3.5" />
        {current.pdfUrl || pending.kind === 'file' ? 'Replace PDF' : 'Choose a PDF'}
      </button>
      {current.pdfUrl && pending.kind === 'keep' && (
        <button type="button" className={cn(link, 'hover:text-destructive')} onClick={() => onChange({ kind: 'remove' })}>
          <Trash2 className="size-3.5" /> Remove
        </button>
      )}
      {pending.kind !== 'keep' && (
        <button type="button" className={link} onClick={() => onChange({ kind: 'keep' })}>
          <RotateCcw className="size-3.5" /> Undo
        </button>
      )}
    </span>
  )

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        pick(file)
      }}
    />
  )

  if (!large) {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className="text-xs text-muted-foreground">{status}</span>
        {controls}
        {error && <span className="text-xs text-destructive">{error}</span>}
        {input}
      </div>
    )
  }

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        pick([...event.dataTransfer.files].find((file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)))
      }}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        over ? 'border-steel bg-steel/10' : 'border-steel/25 bg-secondary/40',
      )}
    >
      <FileText aria-hidden className="size-7 text-steel" />
      <p className="text-sm text-muted-foreground">{status}</p>
      <p className="text-xs text-muted-foreground">Drop a PDF here, or use the buttons below.</p>
      {controls}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {input}
    </div>
  )
}
