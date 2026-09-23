import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { ProjectPreview } from '@/components/project-preview'
import { getPublishedProjects } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { PublicProject } from '@/lib/public-content'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Interactive maps, forecasting dashboards, and quantitative tools deployed across commodity, macroeconomic, financial markets, and geopolitical risk research.',
  openGraph: {
    title: 'Projects',
    description:
      'Interactive maps, forecasting dashboards, and quantitative tools.',
  },
}

const statusStyles: Record<string, string> = {
  Live: 'bg-steel/15 text-steel-700',
  'In progress': 'bg-navy text-white',
  'Coming soon': 'bg-secondary text-muted-foreground',
}

function ProjectCard({ project }: { project: PublicProject }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm shadow-navy/5 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/10"
    >
      <div className="relative h-48 overflow-hidden bg-navy">
        <ProjectPreview kind={project.kind} />
        <span className="absolute left-4 top-4 rounded-full bg-steel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {project.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-serif text-2xl leading-snug tracking-tight text-navy transition-colors group-hover:text-steel-700">
          {project.title}
        </h2>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {project.summary}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              statusStyles[project.status] ?? 'bg-secondary text-navy',
            )}
          >
            {project.status}
          </span>
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-sm font-semibold text-steel-700 transition-colors group-hover:text-navy">
            View project &rarr;
          </span>
        </div>
      </div>
    </Link>
  )
}

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof getPublishedProjects>> = []
  let failed = false
  try {
    projects = await getPublishedProjects()
  } catch {
    projects = []
    failed = true
  }

  return (
    <main>
      <PageHeader
        eyebrow="Projects"
        title="Dynamic research, deployed"
        description="A growing collection of interactive tools — maps, forecasting dashboards, and quantitative explorers — that turn research into things you can actually click through."
      />

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
        {failed ? (
          <p className="text-muted-foreground">
            Projects could not be loaded right now. Please try again shortly.
          </p>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground">
            Projects will appear here once they are published from the admin
            dashboard.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-sm text-muted-foreground">
          New interactive projects are deployed here regularly. Check back soon.
        </p>
      </div>
    </main>
  )
}
