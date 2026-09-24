'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { slugify, MAX_PDF_BYTES } from '@/lib/validations'
import {
  createPaperAction,
  createProjectAction,
  updatePaperAction,
  updateProjectAction,
  requestPdfUploadUrl,
  type ActionState,
} from '@/app/admin/actions'

type Kind = 'paper' | 'project'

export type EntryDefaults = {
  title?: string
  slug?: string
  category?: string
  tags?: string
  date?: string
  excerpt?: string
  contentType?: string
  type?: string
  status?: string
  kind?: string
  latexSource?: string | null
  sortOrder?: number
  published?: boolean
}

const initialState: ActionState = {}

export function EntryForm({
  kind,
  entryId,
  defaults,
}: {
  kind: Kind
  entryId?: number
  defaults?: EntryDefaults
}) {
  const [contentType, setContentType] = useState(defaults?.contentType ?? 'pdf')
  const [slug, setSlug] = useState(defaults?.slug ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Pick the right action for this kind/mode. Update actions take `id` as
  // their first argument, ahead of the (prevState, formData) pair
  // useActionState expects — bind it in now so the bound function matches
  // that shape.
  const action =
    kind === 'paper'
      ? entryId
        ? updatePaperAction.bind(null, entryId)
        : createPaperAction
      : entryId
        ? updateProjectAction.bind(null, entryId)
        : createProjectAction

  const [state, formAction, pending] = useActionState(action, initialState)

  // When a bucket is configured (S3_BUCKET/etc. on the server), upload the
  // PDF directly to it via a presigned URL before submitting the rest of
  // the form — the file itself never passes through this server, which is
  // what lets it exceed the small effective size ceiling a Netlify
  // Function imposes on binary bodies. If no bucket is configured,
  // requestPdfUploadUrl returns null and the file is submitted the
  // original way, through the form action.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (contentType !== 'pdf') return // LaTeX source is small text — no upload step needed

    const form = event.currentTarget
    const fileInput = form.elements.namedItem('pdf') as HTMLInputElement | null
    const file = fileInput?.files?.[0]
    if (!file) return // editing without replacing the PDF — nothing to upload

    if (file.size > MAX_PDF_BYTES) {
      event.preventDefault()
      setUploadError(
        `PDF files must be ${Math.round(MAX_PDF_BYTES / (1024 * 1024))}MB or smaller.`,
      )
      return
    }

    event.preventDefault()
    setUploadError(null)
    setUploading(true)
    try {
      const presigned = await requestPdfUploadUrl(file.name)
      if (!presigned) {
        // No bucket configured — fall back to submitting the file itself.
        formAction(new FormData(form))
        return
      }

      const uploadRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      })
      if (!uploadRes.ok) {
        throw new Error('Uploading the PDF to storage failed. Please try again.')
      }

      const fd = new FormData(form)
      fd.delete('pdf')
      fd.set('pdfKey', presigned.key)
      // The bucket is private — this is the app's own `/api/files/[key]`
      // route, which resolves a fresh presigned GET at request time, not a
      // direct bucket URL.
      fd.set('pdfPublicUrl', `/api/files/${encodeURIComponent(presigned.key)}`)
      fd.set('pdfOriginalFilename', file.name)
      formAction(fd)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5"
    >
      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {uploadError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {uploadError}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          Title
          <input
            required
            name="title"
            defaultValue={defaults?.title}
            onBlur={(e) => {
              if (!slug) setSlug(slugify(e.target.value))
            }}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Slug
          <input
            required
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Category / sector
          <input
            required
            name="category"
            defaultValue={defaults?.category}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Date
          <input
            required
            type="date"
            name="date"
            defaultValue={defaults?.date}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy md:col-span-2">
          Tags (comma-separated)
          <input
            name="tags"
            defaultValue={defaults?.tags}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-navy">
        Excerpt
        <textarea
          required
          name="excerpt"
          rows={4}
          defaultValue={defaults?.excerpt}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      {kind === 'paper' ? (
        <label className="block text-sm font-medium text-navy">
          Type
          <select
            name="type"
            defaultValue={defaults?.type ?? 'Paper'}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option>Paper</option>
            <option>Report</option>
            <option>Brief</option>
          </select>
        </label>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-navy">
            Status
            <select
              name="status"
              defaultValue={defaults?.status ?? 'In progress'}
              className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option>Live</option>
              <option>In progress</option>
              <option>Coming soon</option>
            </select>
          </label>
          <label className="text-sm font-medium text-navy">
            Preview kind
            <select
              name="kind"
              defaultValue={defaults?.kind ?? 'dashboard'}
              className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="map">map</option>
              <option value="chart">chart</option>
              <option value="dashboard">dashboard</option>
              <option value="model">model</option>
            </select>
          </label>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-navy">Content type</legend>
        <label className="mr-4 text-sm">
          <input
            type="radio"
            name="contentType"
            value="pdf"
            checked={contentType === 'pdf'}
            onChange={() => setContentType('pdf')}
          />{' '}
          Upload PDF
        </label>
        <label className="text-sm">
          <input
            type="radio"
            name="contentType"
            value="latex"
            checked={contentType === 'latex'}
            onChange={() => setContentType('latex')}
          />{' '}
          Compile from LaTeX
        </label>
      </fieldset>
      {contentType === 'pdf' ? (
        <label className="block text-sm font-medium text-navy">
          PDF file {defaults ? '(leave empty to keep current)' : ''}
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            required={!defaults}
            className="mt-1.5 block w-full text-sm"
          />
        </label>
      ) : (
        <label className="block text-sm font-medium text-navy">
          LaTeX source
          <textarea
            name="latexSource"
            required={!defaults}
            rows={12}
            defaultValue={defaults?.latexSource ?? ''}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs"
          />
        </label>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          Sort order (lower shows first)
          <input
            type="number"
            name="sortOrder"
            defaultValue={defaults?.sortOrder ?? 0}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 self-end text-sm text-navy">
          <input
            type="checkbox"
            name="published"
            defaultChecked={defaults?.published ?? true}
          />
          Published
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        {uploading
          ? 'Uploading PDF…'
          : pending
            ? contentType === 'latex'
              ? 'Compiling…'
              : 'Saving…'
            : 'Save'}
      </button>
    </form>
  )
}
