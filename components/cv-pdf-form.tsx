'use client'

import { useState, type FormEvent } from 'react'
import { MAX_PDF_BYTES } from '@/lib/validations'
import { requestPdfUploadUrl } from '@/app/admin/actions'
import { updateCvPdfAction } from '@/app/admin/cv-actions'

// Same direct-to-bucket presigned-upload pattern as components/entry-form.tsx
// (see its handleSubmit), simplified for a single file with no other form
// fields. Kept as its own small component rather than sharing entry-form's
// handler, since that one is wired to paper/project-specific form fields.
export function CvPdfForm({ currentFilename }: { currentFilename?: string | null }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fileInput = form.elements.namedItem('pdf') as HTMLInputElement | null
    const file = fileInput?.files?.[0]
    if (!file) {
      setError('Choose a PDF file first.')
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`PDF files must be ${Math.round(MAX_PDF_BYTES / (1024 * 1024))}MB or smaller.`)
      return
    }

    setError(null)
    setUploading(true)

    const fd = new FormData()
    fd.set('pdfFilename', file.name)
    try {
      const presigned = await requestPdfUploadUrl(file.name)
      if (presigned) {
        const uploadRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: file,
        })
        if (!uploadRes.ok) {
          throw new Error('Uploading the CV to storage failed. Please try again.')
        }
        fd.set('pdfKey', presigned.key)
      } else {
        // No bucket configured — fall back to uploading the file itself.
        fd.set('pdf', file)
      }
    } catch (err) {
      setUploading(false)
      setError(err instanceof Error ? err.message : 'Upload failed')
      return
    }

    // Outside the try/catch deliberately: redirect() (inside
    // updateCvPdfAction) works by throwing a special signal that this
    // catch block would otherwise intercept and misreport as an upload
    // failure — same reasoning as app/admin/actions.ts.
    await updateCvPdfAction(fd)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5"
    >
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Current file:{' '}
        <span className="text-navy">{currentFilename ?? 'none uploaded yet'}</span>
      </p>
      <label className="block text-sm font-medium text-navy">
        Replace CV PDF
        <input
          type="file"
          name="pdf"
          accept="application/pdf"
          className="mt-1.5 block w-full text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={uploading}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : 'Save'}
      </button>
    </form>
  )
}
