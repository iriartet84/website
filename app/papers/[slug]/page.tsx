import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PdfViewer } from '@/components/pdf-viewer'
import { getPublicPaperBySlug } from '@/lib/queries'

export const revalidate = 3600

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  let paper
  try {
    paper = await getPublicPaperBySlug(slug)
  } catch {
    return { title: 'Toribio Iriarte' }
  }
  if (!paper) return { title: 'Paper not found' }
  return {
    title: paper.title,
    description: paper.excerpt,
    openGraph: {
      title: paper.title,
      description: paper.excerpt,
      type: 'article',
    },
  }
}

export default async function PaperDetailPage({ params }: PageProps) {
  const { slug } = await params

  let paper
  try {
    paper = await getPublicPaperBySlug(slug)
  } catch {
    return (
      <main className="mx-auto max-w-4xl px-5 py-32 text-center sm:px-8">
        <p className="text-sm text-muted-foreground">
          This paper could not be loaded right now — please try again shortly.
        </p>
        <Link
          href="/papers"
          className="mt-4 inline-block text-sm font-medium text-steel-700 hover:text-navy"
        >
          &larr; Back to Papers &amp; Briefs
        </Link>
      </main>
    )
  }
  if (!paper) notFound()

  const year = paper.year || new Date(paper.date).getFullYear().toString()

  return (
    <main>
      <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <Link
            href="/papers"
            className="text-sm font-medium text-steel-700 transition-colors hover:text-navy"
          >
            &larr; Papers &amp; Briefs
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-bold uppercase tracking-[0.14em] text-steel-700">
              {paper.category}
            </span>
            <span className="rounded-full bg-navy px-3 py-1 text-xs font-medium text-white">
              {paper.type}
            </span>
            <span className="text-xs text-muted-foreground">&middot;</span>
            <span className="text-xs text-muted-foreground">{year}</span>
          </div>
          <h1 className="mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl">
            {paper.title}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {paper.abstract}
          </p>
          {paper.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {paper.tags.map((tag) => (
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
        {paper.pdfUrl ? (
          <PdfViewer
            url={paper.pdfUrl}
            title={paper.title}
            filename={paper.pdfFilename}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
            <p className="text-sm text-muted-foreground">
              The full document for this paper is not available yet.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
