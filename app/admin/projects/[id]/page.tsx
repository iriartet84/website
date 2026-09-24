import { redirect } from 'next/navigation'

// The per-project edit form was replaced by the page editor at
// /admin/projects. Old links land on the right project.
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/projects#item-project-${encodeURIComponent(id)}`)
}
