import { Hero } from '@/components/hero'
import { ResearchShowcase } from '@/components/research-showcase'
import { FeaturedProjects } from '@/components/featured-projects'
import { Skillset } from '@/components/skillset'
import { getHomeContent } from '@/lib/site-content'
import { getFeaturedProjects } from '@/lib/queries'
import { featuredBySector } from '@/lib/project-meta'

// Content is editable from /admin/home; saving there revalidates this page,
// as does a project's output refresh (lib/project-refresh.ts).
export const revalidate = 3600

export default async function HomePage() {
  const [content, featured] = await Promise.all([getHomeContent(), getFeaturedProjects()])
  const projects = featuredBySector(featured)
  return (
    <main>
      <Hero content={content.hero} />
      {/* Featured projects take Research Focus's place once any exist. */}
      {projects.length > 0 ? (
        <FeaturedProjects content={content.featured} projects={projects} />
      ) : (
        <ResearchShowcase content={content.research} />
      )}
      <Skillset content={content.skills} />
    </main>
  )
}
