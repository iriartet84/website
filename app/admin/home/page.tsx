import { getHomeContent } from '@/lib/site-content'
import { getFeaturedProjects } from '@/lib/queries'
import { featuredBySector } from '@/lib/project-meta'
import { HomeEditor } from '@/components/admin/home-editor'

export const metadata = { title: 'Edit Home' }

// /admin/home — the public home page, editable. See
// components/admin/home-editor.tsx.
export default async function AdminHomePage() {
  const [content, featured] = await Promise.all([getHomeContent(), getFeaturedProjects()])
  return <HomeEditor content={content} featured={featuredBySector(featured)} />
}
