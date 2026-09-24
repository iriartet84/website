import { redirect } from 'next/navigation'

// The per-entry edit form was replaced by the page editor at /admin/cv,
// where CV entries are edited in place. Old links land on the right entry.
export default async function EditEducationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/cv#item-education-${encodeURIComponent(id)}`)
}
