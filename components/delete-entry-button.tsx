'use client'

import { deletePaperAction, deleteProjectAction } from '@/app/admin/actions'
import {
  deleteExperienceAction,
  deleteEducationAction,
  deleteLanguageAction,
} from '@/app/admin/cv-actions'

export function DeleteEntryButton({
  kind,
  id,
}: {
  kind: 'paper' | 'project' | 'experience' | 'education' | 'language'
  id: number
}) {
  async function onDelete() {
    if (kind === 'paper') await deletePaperAction(id)
    else if (kind === 'project') await deleteProjectAction(id)
    else if (kind === 'experience') await deleteExperienceAction(id)
    else if (kind === 'education') await deleteEducationAction(id)
    else await deleteLanguageAction(id)
  }

  return (
    <form action={onDelete} className="ml-4 inline">
      <button type="submit" className="text-destructive">
        Delete
      </button>
    </form>
  )
}
