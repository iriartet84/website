'use client'

import { deletePaperAction, deleteProjectAction } from '@/app/admin/actions'
import { deleteExperienceAction } from '@/app/admin/cv-actions'

export function DeleteEntryButton({
  kind,
  id,
}: {
  kind: 'paper' | 'project' | 'experience'
  id: number
}) {
  async function onDelete() {
    if (kind === 'paper') await deletePaperAction(id)
    else if (kind === 'project') await deleteProjectAction(id)
    else await deleteExperienceAction(id)
  }

  return (
    <form action={onDelete} className="ml-4 inline">
      <button type="submit" className="text-destructive">
        Delete
      </button>
    </form>
  )
}
