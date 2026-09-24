'use client'

import {
  createEducationAction,
  updateEducationAction,
} from '@/app/admin/cv-actions'

export type EducationDefaults = {
  school?: string
  location?: string
  degree?: string
  period?: string
  details?: string
  sortOrder?: number
  published?: boolean
}

export function EducationForm({
  entryId,
  defaults,
}: {
  entryId?: number
  defaults?: EducationDefaults
}) {
  async function save(formData: FormData) {
    if (entryId) await updateEducationAction(entryId, formData)
    else await createEducationAction(formData)
  }

  return (
    <form action={save} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          School
          <input
            required
            name="school"
            defaultValue={defaults?.school}
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
        <label className="text-sm font-medium text-navy md:col-span-2">
          Degree (e.g. MSc in Macroeconomic Policy — GPA 8.7/10)
          <input
            required
            name="degree"
            defaultValue={defaults?.degree}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Period (e.g. 09/2025 – 2026)
          <input
            required
            name="period"
            defaultValue={defaults?.period}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-navy">
        Details — one per line
        <textarea
          required
          name="details"
          rows={4}
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
