'use client'

import { updateCvProfileAction } from '@/app/admin/cv-actions'

export type CvProfileDefaults = {
  tagline?: string
  nationality?: string
  location?: string
  email?: string
  phone?: string
  linkedin?: string
  linkedinUrl?: string
  programmingSkills?: string
  methodSkills?: string
}

function SaveButton() {
  return (
    <button
      type="submit"
      className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
    >
      Save
    </button>
  )
}

// Three separate <form> elements on purpose: each only submits its own
// fields, and the server action fills in anything missing from whatever
// the row already has (see field() in cv-actions.ts) — so saving just the
// description doesn't touch contact info or skills, and vice versa.

export function CvDescriptionForm({ defaults }: { defaults?: CvProfileDefaults }) {
  return (
    <form
      action={updateCvProfileAction}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5"
    >
      <label className="block text-sm font-medium text-navy">
        Description (shown under &ldquo;Curriculum Vitae&rdquo; at the top of the page)
        <textarea
          required
          name="tagline"
          rows={3}
          defaultValue={defaults?.tagline}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      <SaveButton />
    </form>
  )
}

export function CvContactForm({ defaults }: { defaults?: CvProfileDefaults }) {
  return (
    <form
      action={updateCvProfileAction}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-navy">
          Nationality
          <input
            name="nationality"
            defaultValue={defaults?.nationality}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Based in
          <input
            name="location"
            defaultValue={defaults?.location}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Email
          <input
            type="email"
            name="email"
            defaultValue={defaults?.email}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          Phone
          <input
            name="phone"
            defaultValue={defaults?.phone}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          LinkedIn handle (display text, e.g. linkedin.com/in/you)
          <input
            name="linkedin"
            defaultValue={defaults?.linkedin}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-navy">
          LinkedIn URL
          <input
            name="linkedinUrl"
            defaultValue={defaults?.linkedinUrl}
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
      </div>
      <SaveButton />
    </form>
  )
}

export function CvSkillsForm({ defaults }: { defaults?: CvProfileDefaults }) {
  return (
    <form
      action={updateCvProfileAction}
      className="space-y-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5"
    >
      <label className="block text-sm font-medium text-navy">
        Programming &amp; Tools — one per line
        <textarea
          name="programmingSkills"
          rows={6}
          defaultValue={defaults?.programmingSkills}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-navy">
        Econometric &amp; ML Methods — one per line
        <textarea
          name="methodSkills"
          rows={6}
          defaultValue={defaults?.methodSkills}
          className="mt-1.5 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </label>
      <SaveButton />
    </form>
  )
}
