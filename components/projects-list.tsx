'use client'

import { useState } from 'react'
import { ProjectCard } from '@/components/project-card'
import { PaperFilters } from '@/components/papers-list'
import type { PublicProject } from '@/lib/public-content'

// The /projects grid with the same sector filter as Papers & Briefs. The
// filter appears once projects span at least two sectors, and lists only
// sectors that have projects.
export function ProjectsList({ projects, sectors }: { projects: PublicProject[]; sectors: readonly string[] }) {
  const [filter, setFilter] = useState('All')
  const present = [
    ...sectors.filter((sector) => projects.some((p) => p.category === sector)),
    ...Array.from(new Set(projects.map((p) => p.category))).filter((c) => !sectors.includes(c)),
  ]
  const visible = filter === 'All' ? projects : projects.filter((p) => p.category === filter)

  return (
    <>
      {present.length >= 2 && (
        <div className="mb-8">
          <PaperFilters papers={projects} categories={present} filter={filter} onFilter={setFilter} />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {visible.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </>
  )
}

export function ProjectsComingSoon() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-8 py-16 text-center">
      <p className="font-serif text-2xl tracking-tight text-navy">Live projects are on their way</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Interactive dashboards, nowcasts and models are being built and will be published here as they go live.
      </p>
    </div>
  )
}
