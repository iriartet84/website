import 'katex/dist/katex.min.css'
import { ArticleContents } from '@/components/article-contents'
import type { RenderedArticle } from '@/lib/latex-article'

// A LaTeX paper as an article on its page: byline, abstract, then the body
// (sections, maths, figures, tables, notes, references). The HTML comes from
// renderLatexArticle (lib/latex-article.ts), which escapes all text and only
// lets through safe links and image sources. No server-only imports here, so
// the admin editor's live preview renders exactly the same thing.

const ARTICLE_BODY_ID = 'article-body'

export function LatexArticleView({
  article,
  contents = false,
  showTitle = false,
  className,
}: {
  article: Pick<RenderedArticle, 'html' | 'abstractHtml' | 'authorsHtml' | 'dateHtml' | 'headings' | 'titleHtml'>
  // A "Contents" button (fixed to the right side of the screen) that opens
  // the table of contents.
  contents?: boolean
  // The page header already shows the title; the admin preview shows it.
  showTitle?: boolean
  className?: string
}) {
  const tocHeadings = article.headings.filter((heading) => heading.level <= 2)

  const body = (
    <article className="article-prose min-w-0">
      {showTitle && article.titleHtml && (
        <h1 className="article-title" dangerouslySetInnerHTML={{ __html: article.titleHtml }} />
      )}
      {(article.authorsHtml.length > 0 || article.dateHtml) && (
        <p className="article-byline">
          {article.authorsHtml.map((author, index) => (
            <span key={index}>
              {index > 0 && <span aria-hidden="true" className="article-byline-sep">·</span>}
              <span dangerouslySetInnerHTML={{ __html: author }} />
            </span>
          ))}
          {article.dateHtml && (
            <span>
              {article.authorsHtml.length > 0 && <span aria-hidden="true" className="article-byline-sep">·</span>}
              <span dangerouslySetInnerHTML={{ __html: article.dateHtml }} />
            </span>
          )}
        </p>
      )}
      {article.abstractHtml && (
        <section className="article-abstract" aria-label="Abstract">
          <p className="article-abstract-label">Abstract</p>
          <div dangerouslySetInnerHTML={{ __html: article.abstractHtml }} />
        </section>
      )}
      {/* The body spans the full content width. Its id lets the Contents
          button appear only once the reader is into the body. */}
      <div id={contents ? ARTICLE_BODY_ID : undefined} dangerouslySetInnerHTML={{ __html: article.html }} />
    </article>
  )

  return (
    <div className={className}>
      {contents && tocHeadings.length >= 2 && <ArticleContents headings={tocHeadings} bodyId={ARTICLE_BODY_ID} />}
      {body}
    </div>
  )
}
