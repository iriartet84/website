'use client'

import {
  createExperienceAction,
  updateExperienceAction,
} from '@/app/admin/cv-actions'

export type ExperienceDefaults = {
  org?: string
  role?: string
  location?: string
  period?: string
  summary?: string
  details?: string
  sortOrder?: number
  published?: boolean
}

export function ExperienceForm({
  entryId,
  defaults,
}: {
  entryId?: number
  defaults?: ExperienceDefaults
}) {
  async function save(formData: FormData) {
    if (entryId) await updateExperienceAction(entryId, formData)
    else await createExperienceAction(formData)
  }

  return (
    <form action={save} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          Organisation
          <input
            required
            name="org"
            defaultValue={defaults?.org}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Role
          <input
            required
            name="role"
            defaultValue={defaults?.role}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Location
          <input
            name="location"
            defaultValue={defaults?.location}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Period (e.g. 06/2023 – 07/2025)
          <input
            required
            name="period"
            defaultValue={defaults?.period}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-navy">
        Summary (one line)
        <input
          name="summary"
          defaultValue={defaults?.summary}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-navy">
        Bullet points — one per line
        <textarea
          required
          name="details"
          rows={6}
          defaultValue={defaults?.details}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>

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
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
      >
        Save
      </button>
    </form>
  )
}
