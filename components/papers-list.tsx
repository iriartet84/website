'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { PublicPaper } from '@/lib/public-content'

const typeStyles: Record<string, string> = {
  Paper: 'bg-navy text-white',
  Report: 'bg-steel/15 text-steel-700',
  Brief: 'bg-secondary text-navy',
}

export function PapersList({
  papers,
  categories,
}: {
  papers: PublicPaper[]
  categories: string[]
}) {
  const filters = ['All', ...categories]
  const [filter, setFilter] = useState('All')

  const visible =
    filter === 'All' ? papers : papers.filter((p) => p.category === filter)

  if (papers.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <p className="text-muted-foreground">
          Papers will appear here once they are published from the admin
          dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-16">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const count =
            f === 'All'
              ? papers.length
              : papers.filter((p) => p.category === f).length
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-navy text-white'
                  : 'bg-white text-muted-foreground hover:bg-secondary hover:text-navy',
              )}
            >
              {f}
              <span
                className={cn(
                  'text-xs',
                  filter === f ? 'text-white/60' : 'text-muted-foreground/60',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-8 space-y-10">
        {visible.map((paper) => (
          <article key={paper.slug} className="group">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold uppercase tracking-[0.14em] text-steel-700">
                {paper.category}
              </span>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  typeStyles[paper.type] ?? 'bg-secondary text-navy',
                )}
              >
                {paper.type}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{paper.year}</span>
            </div>

            <Link
              href={`/papers/${paper.slug}`}
              className="mt-4 block font-serif text-2xl leading-snug tracking-tight text-navy transition-colors hover:text-steel-700 md:text-3xl"
            >
              {paper.title}
            </Link>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {paper.excerpt}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {paper.tags.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
                >
                  {m}
                </span>
              ))}
              <Link
                href={`/papers/${paper.slug}`}
                className="ml-auto text-sm font-semibold text-steel-700 transition-colors hover:text-navy"
              >
                Read full paper &rarr;
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
