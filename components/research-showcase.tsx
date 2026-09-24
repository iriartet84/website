'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EditableText } from '@/components/admin/editable'
import {
  indexLabel,
  type HomeContent,
  type HomeResearchSection,
} from '@/lib/site-content-shared'

type ResearchContent = HomeContent['research']

// `edit` is only passed by the admin Home editor. In edit mode the carousel
// can't be dragged (dragging would fight text selection) — the arrow
// buttons and dots still move it, and focusing text in a card scrolls that
// card to the centre.
export function ResearchShowcase({
  content,
  edit,
}: {
  content: ResearchContent
  edit?: {
    onHeaderChange: (field: 'eyebrow' | 'heading', value: string) => void
    onItemChange: (index: number, patch: Partial<HomeResearchSection>) => void
    wrapItem: (section: HomeResearchSection, index: number, card: ReactNode) => ReactNode
    imageControl: (section: HomeResearchSection, index: number) => ReactNode
    headerActions?: ReactNode
    // Set when a card is added so the carousel can bring it into view.
    focusIndex?: number | null
  }
}) {
  const editing = Boolean(edit)
  const options = useMemo(
    () => ({
      align: 'center' as const,
      loop: true,
      skipSnaps: false,
      containScroll: 'trimSnaps' as const,
      watchDrag: !editing,
    }),
    [editing],
  )
  const [emblaRef, emblaApi] = useEmblaCarousel(options)
  const [selected, setSelected] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelected(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  const sectionCount = content.sections.length
  const focusIndex = edit?.focusIndex
  useEffect(() => {
    if (!emblaApi || focusIndex === null || focusIndex === undefined) return
    emblaApi.reInit()
    emblaApi.scrollTo(focusIndex)
  }, [emblaApi, focusIndex, sectionCount])

  return (
    <section
      id="research-showcase"
      aria-label="Research focus areas"
      className="bg-white py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            {edit ? (
              <>
                <EditableText
                  as="p"
                  value={content.eyebrow}
                  label="Research eyebrow"
                  className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700"
                  onChange={(value) => edit.onHeaderChange('eyebrow', value)}
                />
                <EditableText
                  as="h2"
                  value={content.heading}
                  label="Research heading"
                  className="mt-3 font-serif text-3xl tracking-tight text-navy md:text-4xl"
                  onChange={(value) => edit.onHeaderChange('heading', value)}
                />
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
                  {content.eyebrow}
                </p>
                <h2 className="mt-3 font-serif text-3xl tracking-tight text-navy md:text-4xl">
                  {content.heading}
                </h2>
              </>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {edit?.headerActions}
            <button
              type="button"
              aria-label="Previous research area"
              onClick={() => emblaApi?.scrollPrev()}
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-navy transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next research area"
              onClick={() => emblaApi?.scrollNext()}
              className="inline-flex size-10 items-center justify-center rounded-full bg-navy text-white transition-colors hover:bg-navy-800"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10 overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {content.sections.map((section, i) => {
            const card = (
              <div
                className={cn(
                  'flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-secondary transition-[transform,opacity] duration-500',
                  i === selected ? 'opacity-100' : 'opacity-70',
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-navy">
                  <img
                    src={section.image || '/placeholder.svg'}
                    alt=""
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
                  <span className="absolute left-5 top-5 font-serif text-4xl text-white/90">
                    {indexLabel(i)}
                  </span>
                  {edit ? (
                    <>
                      <EditableText
                        value={section.label}
                        label="Card label"
                        className="absolute bottom-5 left-5 text-sm font-semibold uppercase tracking-[0.16em] text-white outline-white/40 hover:outline-white/80 focus:outline-white"
                        onChange={(value) => edit.onItemChange(i, { label: value })}
                      />
                      {edit.imageControl(section, i)}
                    </>
                  ) : (
                    <span className="absolute bottom-5 left-5 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                      {section.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  {edit ? (
                    <>
                      <EditableText
                        as="h3"
                        value={section.title}
                        label="Card title"
                        className="font-serif text-2xl tracking-tight text-navy"
                        onChange={(value) => edit.onItemChange(i, { title: value })}
                      />
                      <EditableText
                        as="p"
                        value={section.description}
                        label="Card description"
                        multiline
                        className="mt-3 text-sm leading-relaxed text-muted-foreground"
                        onChange={(value) => edit.onItemChange(i, { description: value })}
                      />
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-steel-700">
                        Explore related work
                        <ArrowUpRight className="size-4" />
                      </span>
                    </>
                  ) : (
                    <>
                      <h3 className="font-serif text-2xl tracking-tight text-navy">
                        {section.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {section.description}
                      </p>
                      <Link
                        href="/papers"
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-steel-700 hover:text-navy"
                      >
                        Explore related work
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )

            return (
              <article
                key={section.id}
                className="flex min-w-0 shrink-0 grow-0 basis-[88%] justify-center px-3 sm:basis-[70%] md:basis-[52%] lg:basis-[42%]"
                onFocusCapture={edit ? () => emblaApi?.scrollTo(i) : undefined}
              >
                {edit ? edit.wrapItem(section, i, card) : card}
              </article>
            )
          })}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-2">
        {content.sections.map((section, i) => (
          <button
            key={section.id}
            type="button"
            aria-label={`Go to ${section.label}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              'h-2 rounded-full transition-all',
              i === selected ? 'w-7 bg-steel' : 'w-2 bg-border hover:bg-steel/40',
            )}
          />
        ))}
      </div>
    </section>
  )
}
