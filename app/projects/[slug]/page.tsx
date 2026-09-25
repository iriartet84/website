import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProjectBody, ProjectHeader } from '@/components/project-page'
import { getPublicProjectBySlug } from '@/lib/queries'

export const revalidate = 3600

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  let project
  try {
    project = await getPublicProjectBySlug(slug)
  } catch {
    return { title: 'Toribio Iriarte' }
  }
  if (!project) return { title: 'Project not found' }
  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
    },
  }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params

  let project
  try {
    project = await getPublicProjectBySlug(slug)
  } catch {
    return (
      <main className="mx-auto max-w-4xl px-5 py-32 text-center sm:px-8">
        <p className="text-sm text-muted-foreground">
          This project could not be loaded right now — please try again shortly.
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-block text-sm font-medium text-steel-700 hover:text-navy"
        >
          &larr; Back to Projects
        </Link>
      </main>
    )
  }
  if (!project) notFound()

  return (
    <main>
      <ProjectHeader project={project} />
      <div className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
        <ProjectBody project={project} />
      </div>
    </main>
  )
}
