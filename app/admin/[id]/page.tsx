import { redirect } from 'next/navigation'

// This older route edited a CV experience entry; CV entries are now edited
// in place at /admin/cv.
export default async function LegacyExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/cv#item-experience-${encodeURIComponent(id)}`)
}
