import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { ProjectsComingSoon, ProjectsList } from '@/components/projects-list'
import { getPublishedProjects } from '@/lib/queries'
import { projectSectors } from '@/lib/project-meta'
import { getListPageContent } from '@/lib/site-content'

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

export default async function ProjectsPage() {
  const { header } = await getListPageContent('projects')
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
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
      />

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
        {failed ? (
          <p className="text-muted-foreground">
            Projects could not be loaded right now. Please try again shortly.
          </p>
        ) : projects.length === 0 ? (
          <ProjectsComingSoon />
        ) : (
          <ProjectsList projects={projects} sectors={projectSectors} />
        )}

        <p className="mt-12 text-center text-sm text-muted-foreground">
          New interactive projects are deployed here regularly. Check back soon.
        </p>
      </div>
    </main>
  )
}
