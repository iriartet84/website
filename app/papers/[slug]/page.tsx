import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'
import { PdfViewer } from '@/components/pdf-viewer'
import { LatexArticleView } from '@/components/latex-article-view'
import { GithubIcon } from '@/components/social-links'
import { getPublicPaperBySlug } from '@/lib/queries'
import { renderLatexArticle } from '@/lib/latex-article'
import { cn } from '@/lib/utils'

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
  // A paper is either a LaTeX article (read on the page, with an optional
  // attached PDF for "Download PDF") or a PDF (shown in the reader).
  const article = paper.contentType === 'latex' && paper.latexSource ? renderLatexArticle(paper.latexSource) : null
  // The optional Long Abstract: plain text, blank lines between
  // paragraphs. Empty or missing renders nothing at all.
  const longAbstract = (paper.longAbstract ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  // Only a real PDF gets a PDF button: a missing, null or empty pdfUrl
  // shows none at all.
  const pdfUrl = paper.pdfUrl?.trim() || null
  const downloadUrl = pdfUrl
    ? `${pdfUrl}?download=1&filename=${encodeURIComponent(paper.pdfFilename || `${paper.slug}.pdf`)}`
    : null

  return (
    <main>
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40 print:pb-6 print:pt-0">
          <Link
            href="/papers"
            className="text-sm font-medium text-steel-700 transition-colors hover:text-navy print:hidden"
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
          <h1 className="mt-4 max-w-none font-serif text-4xl tracking-tight text-navy md:text-5xl">
            {paper.title}
          </h1>
          <p className="mt-5 max-w-none text-pretty text-lg leading-relaxed text-muted-foreground">
            {paper.abstract}
          </p>
          {(paper.tags.length > 0 || (article && downloadUrl) || paper.githubUrl) && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {paper.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
                >
                  {tag}
                </span>
              ))}
              {paper.githubUrl && (
                <a
                  href={paper.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:border-steel/40 hover:bg-secondary print:hidden',
                    !(article && downloadUrl) && 'ml-auto',
                  )}
                >
                  <GithubIcon className="size-4" />
                  GitHub
                </a>
              )}
              {article && downloadUrl && (
                <a
                  href={downloadUrl}
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-800 print:hidden"
                >
                  <Download aria-hidden className="size-4" />
                  Download PDF
                </a>
              )}
            </div>
          )}
        </header>

        {longAbstract.length > 0 && (
          <section className="long-abstract" aria-labelledby="long-abstract-label">
            <p id="long-abstract-label" className="long-abstract-label">
              Abstract
            </p>
            {longAbstract.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        )}

        <div className="pb-24">
          {article ? (
            <LatexArticleView article={article} contents />
          ) : pdfUrl ? (
            <PdfViewer url={pdfUrl} title={paper.title} filename={paper.pdfFilename} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center">
              <p className="text-sm text-muted-foreground">
                The full document for this paper is not available yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
