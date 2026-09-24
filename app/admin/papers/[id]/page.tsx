import { redirect } from 'next/navigation'

// The per-paper edit form was replaced by the page editor at /admin/papers,
// where every paper is edited in place. Old links land on the right paper.
export default async function EditPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/papers#item-paper-${encodeURIComponent(id)}`)
}
