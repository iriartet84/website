'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { researchSections } from '@/lib/content'

export function ResearchShowcase() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    loop: true,
    skipSnaps: false,
    containScroll: 'trimSnaps',
  })
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

  return (
    <section
      id="research-showcase"
      aria-label="Research focus areas"
      className="bg-white py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
              Research Focus
            </p>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-navy md:text-4xl">
              Commodity research, in context
            </h2>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
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
          {researchSections.map((section, i) => (
            <article
              key={section.id}
              className="flex min-w-0 shrink-0 grow-0 basis-[88%] justify-center px-3 sm:basis-[70%] md:basis-[52%] lg:basis-[42%]"
            >
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
                    {section.index}
                  </span>
                  <span className="absolute bottom-5 left-5 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                    {section.label}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
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
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-2">
        {researchSections.map((section, i) => (
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
