import { getHomeContent } from '@/lib/site-content'
import { HomeEditor } from '@/components/admin/home-editor'

export const metadata = { title: 'Edit Home' }

// /admin/home — the public home page, editable. See
// components/admin/home-editor.tsx.
export default async function AdminHomePage() {
  const content = await getHomeContent()
  return <HomeEditor content={content} />
}
