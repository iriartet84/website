'use client'

import { useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { FileCode2, FileText, RotateCcw, Upload } from 'lucide-react'
import { validateFile } from '@/components/admin/upload'

// The document behind a paper or project, managed from where the public
// page shows its "Read full paper →" / "View project →" link. A new PDF
// (or LaTeX source) is only a pending change here; it's uploaded — straight
// to the private bucket, via a presigned URL — or compiled when the page is
// saved.

export type DocumentState =
  | { kind: 'keep' }
  | { kind: 'file'; file: File }
  | { kind: 'latex'; source: string }

export function DocumentControl({
  current,
  pending,
  latexSource,
  onChange,
}: {
  current: { url: string | null; filename: string | null; contentType: string }
  pending: DocumentState
  latexSource: string | null
  onChange: (next: DocumentState) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const linkClass = 'text-sm font-semibold text-steel-700 transition-colors hover:text-navy'

  let label: React.ReactNode
  if (pending.kind === 'file') {
    label = (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
        <FileText className="size-4 text-steel" />
        {pending.file.name}
        <span className="font-normal text-muted-foreground">— uploads on save</span>
      </span>
    )
  } else if (pending.kind === 'latex') {
    label = (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
        <FileCode2 className="size-4 text-steel" />
        LaTeX source
        <span className="font-normal text-muted-foreground">— compiles on save</span>
      </span>
    )
  } else if (current.url) {
    label = (
      <a href={current.url} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-1.5`} title="Open the current document">
        {current.contentType === 'latex' ? <FileCode2 className="size-4" /> : <FileText className="size-4" />}
        {current.filename ?? 'Document'}
      </a>
    )
  } else {
    label = <span className="text-sm text-muted-foreground">No document yet</span>
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1 font-sans">
      {label}
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
      <button type="button" onClick={() => inputRef.current?.click()} className={`${linkClass} inline-flex items-center gap-1`}>
        <Upload className="size-3.5" />
        {current.url || pending.kind !== 'keep' ? 'Replace PDF' : 'Upload PDF'}
      </button>
      <Dialog.Root
        onOpenChange={(open) => {
          if (open) setDraft(pending.kind === 'latex' ? pending.source : latexSource ?? '')
        }}
      >
        <Dialog.Trigger className={`${linkClass} inline-flex items-center gap-1`}>
          <FileCode2 className="size-3.5" />
          LaTeX
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-navy/30 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-white p-6 font-sans shadow-2xl outline-none transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div>
              <Dialog.Title className="font-serif text-2xl text-navy">Compile from LaTeX</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                The source is compiled into the PDF visitors see when you save the page. It replaces any
                uploaded PDF.
              </Dialog.Description>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={18}
              spellCheck={false}
              className="min-h-0 flex-1 rounded-lg border border-border p-3 font-mono text-xs text-navy outline-none focus:border-steel focus:ring-2 focus:ring-steel/20"
              placeholder={'\\documentclass{article}\n\\begin{document}\n…\n\\end{document}'}
            />
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-full px-4 py-2 text-sm text-navy hover:bg-secondary">Cancel</Dialog.Close>
              <Dialog.Close
                disabled={!draft.trim()}
                onClick={() => onChange({ kind: 'latex', source: draft })}
                className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
              >
                Use this source
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {pending.kind !== 'keep' && (
        <button type="button" onClick={() => onChange({ kind: 'keep' })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-navy">
          <RotateCcw className="size-3" />
          Undo
        </button>
      )}
      {error && <span className="basis-full text-right text-xs text-destructive">{error}</span>}
    </span>
  )
}
