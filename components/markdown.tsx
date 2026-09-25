import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'

// Markdown for project write-ups: GitHub-flavoured Markdown (tables, lists,
// links) plus LaTeX maths — $inline$ and $$display$$ — rendered by KaTeX.
// Raw HTML in the source is not rendered (react-markdown ignores it without
// rehype-raw), and unsafe link protocols are dropped, so the text can't
// inject markup into the page. Write \$ for a literal dollar sign.
//
// Works in server components (the public page) and client components (the
// admin editor's live preview).

// Section headings on the page are h2, so headings inside a write-up start
// at h3.
const components: Components = {
  h1: ({ node: _node, ...props }) => <h3 {...props} />,
  h2: ({ node: _node, ...props }) => <h3 {...props} />,
  h3: ({ node: _node, ...props }) => <h4 {...props} />,
  h4: ({ node: _node, ...props }) => <h5 {...props} />,
  h5: ({ node: _node, ...props }) => <h6 {...props} />,
  a: ({ node: _node, href, ...props }) => {
    const external = typeof href === 'string' && /^https?:\/\//.test(href)
    return <a href={href} {...props} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} />
  },
  img: ({ node: _node, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} loading="lazy" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="project-prose-table">
      <table {...props} />
    </div>
  ),
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('project-prose', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
