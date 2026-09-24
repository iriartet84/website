import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PdfViewer } from '@/components/pdf-viewer'
import { getPublicProjectBySlug } from '@/lib/queries'
import { cn } from '@/lib/utils'

export const revalidate = 3600

const statusStyles: Record<string, string> = {
  Live: 'bg-steel/15 text-steel-700',
  'In progress': 'bg-navy text-white',
  'Coming soon': 'bg-secondary text-muted-foreground',
}

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
      <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Link
            href="/projects"
            className="text-sm font-medium text-steel-700 transition-colors hover:text-navy"
          >
            &larr; Projects
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-steel-700">
              {project.category}
            </span>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                statusStyles[project.status] ?? 'bg-secondary text-navy',
              )}
            >
              {project.status}
            </span>
          </div>
          <h1 className="mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl">
            {project.title}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {project.summary}
          </p>
          {project.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pb-20 sm:px-8">
        {project.pdfUrl ? (
          <PdfViewer
            url={project.pdfUrl}
            title={project.title}
            filename={project.pdfFilename}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
            <p className="text-sm text-muted-foreground">
              This project is still in the works &mdash; the interactive build
              or document will appear here soon.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
