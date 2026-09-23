import { Hero } from '@/components/hero'
import { ResearchShowcase } from '@/components/research-showcase'
import { Skillset } from '@/components/skillset'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ResearchShowcase />
      <Skillset />
    </main>
  )
}
