'use client'

import { useState } from 'react'
import { slugify } from '@/lib/validations'
import {
  createPaperAction,
  createProjectAction,
  updatePaperAction,
  updateProjectAction,
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
  published?: boolean
}

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

  async function save(formData: FormData) {
    if (kind === 'paper') {
      if (entryId) await updatePaperAction(entryId, formData)
      else await createPaperAction(formData)
      return
    }
    if (entryId) await updateProjectAction(entryId, formData)
    else await createProjectAction(formData)
  }

  return (
    <form action={save} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5">
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
      <label className="flex items-center gap-2 text-sm text-navy">
        <input
          type="checkbox"
          name="published"
          defaultChecked={defaults?.published ?? true}
        />
        Published
      </label>
      <button
        type="submit"
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
      >
        Save
      </button>
    </form>
  )
}
