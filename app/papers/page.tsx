import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { PapersList } from '@/components/papers-list'
import { paperCategories, getPublishedPapers } from '@/lib/queries'
import { getListPageContent } from '@/lib/site-content'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Papers & Briefs',
  description:
    'Research papers, reports, and policy briefs across Macroeconomics, Geopolitical Risk, Commodity Research, and Financial Markets.',
  openGraph: {
    title: 'Papers & Briefs',
    description:
      'Research papers, reports, and policy briefs across macroeconomics, commodities, markets, and geopolitical risk.',
  },
}

export default async function PapersPage() {
  const { header } = await getListPageContent('papers')
  let papers: Awaited<ReturnType<typeof getPublishedPapers>> = []
  let failed = false
  try {
    papers = await getPublishedPapers()
  } catch {
    papers = []
    failed = true
  }

  return (
    <main>
      <PageHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
      />
      {failed ? (
        <p className="mx-auto max-w-6xl px-5 py-16 text-muted-foreground sm:px-8">
          Papers could not be loaded right now. Please try again shortly.
        </p>
      ) : (
        <>
          <PapersList papers={papers} categories={[...paperCategories]} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                papers.map((paper) => ({
                  '@context': 'https://schema.org',
                  '@type': 'ScholarlyArticle',
                  headline: paper.title,
                  datePublished: paper.date,
                  author: {
                    '@type': 'Person',
                    name: 'Toribio Iriarte',
                  },
                  about: paper.category,
                  description: paper.excerpt,
                  url: paper.pdfUrl,
                })),
              ),
            }}
          />
        </>
      )}
    </main>
  )
}
