'use client'

import {
  createLanguageAction,
  updateLanguageAction,
} from '@/app/admin/cv-actions'

export type LanguageDefaults = {
  name?: string
  level?: string
  sortOrder?: number
  published?: boolean
}

export function LanguageForm({
  entryId,
  defaults,
}: {
  entryId?: number
  defaults?: LanguageDefaults
}) {
  async function save(formData: FormData) {
    if (entryId) await updateLanguageAction(entryId, formData)
    else await createLanguageAction(formData)
  }

  return (
    <form action={save} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          Language
          <input
            required
            name="name"
            defaultValue={defaults?.name}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Level (e.g. Native, Fluent, B1)
          <input
            required
            name="level"
            defaultValue={defaults?.level}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>

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
