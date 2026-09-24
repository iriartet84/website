import { Hero } from '@/components/hero'
import { ResearchShowcase } from '@/components/research-showcase'
import { Skillset } from '@/components/skillset'
import { getHomeContent } from '@/lib/site-content'

// Content is editable from /admin/home; saving there revalidates this page.
export const revalidate = 3600

export default async function HomePage() {
  const content = await getHomeContent()
  return (
    <main>
      <Hero content={content.hero} />
      <ResearchShowcase content={content.research} />
      <Skillset content={content.skills} />
    </main>
  )
}
