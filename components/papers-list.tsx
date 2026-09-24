'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EditableSelect, EditableTags, EditableText } from '@/components/admin/editable'
import type { PublicPaper } from '@/lib/public-content'

const typeStyles: Record<string, string> = {
  Paper: 'bg-navy text-white',
  Report: 'bg-steel/15 text-steel-700',
  Brief: 'bg-secondary text-navy',
}

export const paperTypes = ['Paper', 'Report', 'Brief'] as const

const tagClass = 'rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700'

export type PaperArticleEdit = {
  onChange: (
    patch: Partial<Pick<PublicPaper, 'title' | 'excerpt' | 'category' | 'type' | 'tags'>>,
  ) => void
  categories: readonly string[]
  // Rendered where the public page shows the year / the "Read full paper"
  // link: the admin editor puts its date picker and PDF controls there.
  yearControl: ReactNode
  documentControl: ReactNode
}

// One paper as it appears on /papers. The admin Papers editor renders the
// same component with `edit`, so what you edit is what visitors see.
export function PaperArticle({ paper, edit }: { paper: PublicPaper; edit?: PaperArticleEdit }) {
  const typeChip = (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        typeStyles[paper.type] ?? 'bg-secondary text-navy',
      )}
    >
      {paper.type}
    </span>
  )
  const categoryLabel = (
    <span className="text-sm font-bold uppercase tracking-[0.14em] text-steel-700">
      {paper.category}
    </span>
  )

  return (
    <article className="group">
      <div className="flex flex-wrap items-center gap-2.5">
        {edit ? (
          <EditableSelect
            value={paper.category}
            options={edit.categories}
            label="Category"
            className="rounded-sm"
            onChange={(category) => edit.onChange({ category })}
          >
            {categoryLabel}
          </EditableSelect>
        ) : (
          categoryLabel
        )}
        {edit ? (
          <EditableSelect
            value={paper.type}
            options={paperTypes}
            label="Type"
            onChange={(type) => edit.onChange({ type })}
          >
            {typeChip}
          </EditableSelect>
        ) : (
          typeChip
        )}
        <span className="text-xs text-muted-foreground">·</span>
        {edit ? edit.yearControl : <span className="text-xs text-muted-foreground">{paper.year}</span>}
      </div>

      {edit ? (
        <EditableText
          as="h2"
          value={paper.title}
          label="Title"
          placeholder="Paper title"
          className="mt-4 block font-serif text-2xl leading-snug tracking-tight text-navy md:text-3xl"
          onChange={(title) => edit.onChange({ title })}
        />
      ) : (
        <Link
          href={`/papers/${paper.slug}`}
          className="mt-4 block font-serif text-2xl leading-snug tracking-tight text-navy transition-colors hover:text-steel-700 md:text-3xl"
        >
          {paper.title}
        </Link>
      )}
      {edit ? (
        <EditableText
          as="p"
          value={paper.excerpt}
          label="Summary"
          placeholder="A short summary of the paper (at least 20 characters)"
          multiline
          className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground"
          onChange={(excerpt) => edit.onChange({ excerpt })}
        />
      ) : (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {paper.excerpt}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {edit ? (
          <EditableTags tags={paper.tags} chipClassName={tagClass} onChange={(tags) => edit.onChange({ tags })} />
        ) : (
          paper.tags.map((m) => (
            <span key={m} className={tagClass}>
              {m}
            </span>
          ))
        )}
        {edit ? (
          <span className="ml-auto">{edit.documentControl}</span>
        ) : (
          <Link
            href={`/papers/${paper.slug}`}
            className="ml-auto text-sm font-semibold text-steel-700 transition-colors hover:text-navy"
          >
            Read full paper &rarr;
          </Link>
        )}
      </div>
    </article>
  )
}

export function PaperFilters({
  papers,
  categories,
  filter,
  onFilter,
}: {
  papers: Pick<PublicPaper, 'category'>[]
  categories: readonly string[]
  filter: string
  onFilter: (filter: string) => void
}) {
  const filters = ['All', ...categories]
  return (
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
            onClick={() => onFilter(f)}
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
  )
}

export function PapersList({
  papers,
  categories,
}: {
  papers: PublicPaper[]
  categories: string[]
}) {
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
      <PaperFilters papers={papers} categories={categories} filter={filter} onFilter={setFilter} />

      <div className="mt-8 space-y-10">
        {visible.map((paper) => (
          <PaperArticle key={paper.slug} paper={paper} />
        ))}
      </div>
    </div>
  )
}
