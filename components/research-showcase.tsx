'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EditableText } from '@/components/admin/editable'
import { categoryParam, paperCategoryForSection } from '@/lib/content'
import {
  indexLabel,
  type HomeContent,
  type HomeResearchSection,
} from '@/lib/site-content-shared'

type ResearchContent = HomeContent['research']

// A native horizontal scroller with CSS scroll snapping: trackpads scroll it
// sideways, touch swipes it, and a mouse can drag it (handled below); the
// arrow buttons and dots also move it. Each card links to Papers & Briefs
// filtered to that card's category.
//
// It loops: the cards are rendered three times in a row and the carousel
// rests in the middle copy, with copies of the neighbours on either side.
// Whenever scrolling settles in the first or last copy, it jumps — without
// animation, by exactly one copy's width — to the same card in the middle
// copy, so it can be scrolled forever either way. Only the middle copy is
// in the tab order / accessibility tree; the copies on either side are
// aria-hidden (in edit mode they're also inert previews).
//
// `edit` is only passed by the admin Home editor. In edit mode mouse
// dragging is off (it would fight text selection) and cards aren't links —
// trackpad/touch scrolling, the arrows and the dots still move it, and
// focusing text in a card scrolls that card to the centre.
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const sectionCount = content.sections.length
  const looping = sectionCount > 1
  const copies = looping ? 3 : 1
  const slotCount = sectionCount * copies
  // First slot of the middle (real) copy.
  const middle = looping ? sectionCount : 0
  const [selectedSlot, setSelectedSlot] = useState(middle)
  const selected = sectionCount ? selectedSlot % sectionCount : 0
  // Hidden until it has been positioned on the middle copy (avoids a jump
  // on first paint; a <noscript> style below shows it without JS).
  const [ready, setReady] = useState(false)
  const dragging = useRef(false)

  const nearestSlot = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return 0
    const centre = scroller.scrollLeft + scroller.clientWidth / 2
    let best = 0
    let bestDistance = Infinity
    itemRefs.current.forEach((item, k) => {
      if (!item) return
      const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - centre)
      if (distance < bestDistance) {
        bestDistance = distance
        best = k
      }
    })
    return best
  }, [])

  const scrollToSlot = useCallback((slot: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current
    const item = itemRefs.current[slot]
    if (!scroller || !item) return
    scroller.scrollTo({ left: item.offsetLeft + item.offsetWidth / 2 - scroller.clientWidth / 2, behavior })
  }, [])

  // Settled in an outer copy: jump to the same card in the middle copy.
  const recentre = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller || !looping || dragging.current) return
    const slot = nearestSlot()
    const copy = Math.floor(slot / sectionCount)
    if (copy === 1) return
    const first = itemRefs.current[0]
    const next = itemRefs.current[sectionCount]
    if (!first || !next) return
    const copyWidth = next.offsetLeft - first.offsetLeft
    scroller.style.scrollBehavior = 'auto'
    scroller.scrollLeft += copy === 0 ? copyWidth : -copyWidth
    scroller.style.scrollBehavior = ''
    setSelectedSlot(nearestSlot())
  }, [looping, nearestSlot, sectionCount])

  // Start on the first card of the middle copy (and re-centre on the same
  // card if the number of cards changes).
  useLayoutEffect(() => {
    scrollToSlot(middle + Math.min(selected, Math.max(sectionCount - 1, 0)), 'instant')
    setSelectedSlot(nearestSlot())
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionCount])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let frame = 0
    let idle = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setSelectedSlot(nearestSlot()))
      // `scrollend` isn't available everywhere (older Safari): also treat
      // a short pause in scroll events as the end.
      window.clearTimeout(idle)
      idle = window.setTimeout(recentre, 160)
    }
    const onScrollEnd = () => {
      window.clearTimeout(idle)
      recentre()
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    scroller.addEventListener('scrollend', onScrollEnd)
    const resize = new ResizeObserver(onScroll)
    resize.observe(scroller)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(idle)
      scroller.removeEventListener('scroll', onScroll)
      scroller.removeEventListener('scrollend', onScrollEnd)
      resize.disconnect()
    }
  }, [nearestSlot, recentre])

  const focusIndex = edit?.focusIndex
  useEffect(() => {
    if (focusIndex === null || focusIndex === undefined) return
    scrollToSlot(middle + focusIndex)
  }, [scrollToSlot, focusIndex, middle, sectionCount])

  // Arrows: one card either way — the loop takes care of the ends.
  const step = (direction: 1 | -1) =>
    scrollToSlot(Math.min(Math.max(selectedSlot + direction, 0), slotCount - 1))

  // Dots: the copy of that card nearest to where the carousel is now.
  const goTo = (index: number) => {
    let best = middle + index
    for (let copy = 0; copy < copies; copy++) {
      const slot = copy * sectionCount + index
      if (Math.abs(slot - selectedSlot) < Math.abs(best - selectedSlot)) best = slot
    }
    scrollToSlot(best)
  }

  // Mouse drag (touch and trackpads scroll natively). Snapping is paused
  // while dragging, then the nearest card — or the next one, after a
  // decisive flick — is scrolled into place. A drag that moved suppresses
  // the click that ends it, so releasing over a card doesn't open it.
  const drag = useRef<{ x: number; left: number; moved: boolean; pointerId: number; startSlot: number } | null>(null)
  const suppressClick = useRef(false)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (editing || event.pointerType !== 'mouse' || event.button !== 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    drag.current = { x: event.clientX, left: scroller.scrollLeft, moved: false, pointerId: event.pointerId, startSlot: nearestSlot() }
    suppressClick.current = false
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const scroller = scrollerRef.current
    if (!state || !scroller) return
    const dx = event.clientX - state.x
    if (!state.moved) {
      if (Math.abs(dx) < 5) return
      state.moved = true
      dragging.current = true
      scroller.setPointerCapture(state.pointerId)
      scroller.style.scrollSnapType = 'none'
      scroller.style.scrollBehavior = 'auto'
      scroller.dataset.dragging = 'true'
    }
    scroller.scrollLeft = state.left - dx
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    const scroller = scrollerRef.current
    drag.current = null
    if (!state?.moved || !scroller) return
    dragging.current = false
    // The click that ends this drag fires right after pointerup; drop the
    // flag once it has had its chance, so a later click isn't swallowed.
    suppressClick.current = true
    window.setTimeout(() => {
      suppressClick.current = false
    }, 0)
    if (scroller.hasPointerCapture(state.pointerId)) scroller.releasePointerCapture(state.pointerId)
    delete scroller.dataset.dragging
    const dx = event.clientX - state.x
    // Nearest card to the centre now, nudged one further after a flick
    // that didn't quite reach it.
    // (Compared with the card the drag started on — the selection has
    // already followed the scroll by now.)
    let target = nearestSlot()
    if (target === state.startSlot && Math.abs(dx) > 60) target = state.startSlot + (dx < 0 ? 1 : -1)
    target = Math.min(Math.max(target, 0), slotCount - 1)
    scroller.style.scrollSnapType = ''
    scroller.style.scrollBehavior = ''
    scrollToSlot(target)
  }

  // One card. `editable` only for the middle copy in edit mode; the other
  // copies render the public look.
  const renderCardBody = (section: HomeResearchSection, i: number, editable: boolean) => (
    <>
      <div className="relative aspect-square overflow-hidden bg-navy">
        <img
          src={section.image || '/placeholder.svg'}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
        <span className="absolute left-5 top-5 font-serif text-2xl text-white/90">
          {indexLabel(i)}
        </span>
        {edit && editable ? (
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
        {edit && editable ? (
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
            <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-steel-700 transition-colors group-hover:text-navy">
              Explore related work
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </>
        )}
      </div>
    </>
  )

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
                  className="text-sm font-semibold uppercase tracking-[0.2em] text-steel-700 md:text-base"
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-steel-700 md:text-base">
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
              onClick={() => step(-1)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-background text-navy transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next research area"
              onClick={() => step(1)}
              className="inline-flex size-10 items-center justify-center rounded-full bg-navy text-white transition-colors hover:bg-navy-800"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* The carousel sits in the same centred, padded column as the rest
          of the page, so it can never be wider than the viewport: the
          scroller fills that column (min-w-0 so its row of cards can't
          size it) and scrolls its cards inside it. */}
      <div className="mx-auto mt-10 w-full max-w-6xl px-5 sm:px-8">
        <div
          ref={scrollerRef}
          data-carousel
          className={cn(
            'scrollbar-none relative flex w-full min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth pb-2 transition-opacity duration-300',
            !editing && 'cursor-grab data-[dragging=true]:cursor-grabbing data-[dragging=true]:select-none',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault()
              event.stopPropagation()
              suppressClick.current = false
            }
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          {/* Without a loop (a single card), spacers let it reach the centre;
              they're half of what a card leaves free at each breakpoint. */}
          {!looping && <div aria-hidden className="shrink-0 basis-[6%] sm:basis-[15%] md:basis-[24%] lg:basis-[29%]" />}
          {Array.from({ length: slotCount }, (_, slot) => {
            const i = slot % sectionCount
            const section = content.sections[i]
            const isReal = Math.floor(slot / sectionCount) === (looping ? 1 : 0)
            const category = paperCategoryForSection(section)
            const href = category ? `/papers?category=${categoryParam(category)}` : '/papers'
            const cardClass = cn(
              'flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-secondary transition-[transform,opacity] duration-500',
              slot === selectedSlot ? 'opacity-100' : 'opacity-70',
            )

            let card: ReactNode
            if (edit) {
              card = isReal ? (
                edit.wrapItem(section, i, <div className={cardClass}>{renderCardBody(section, i, true)}</div>)
              ) : (
                <div className={cardClass} inert>
                  {renderCardBody(section, i, false)}
                </div>
              )
            } else {
              // The whole card is the link (no nested interactive elements
              // inside it). Copies stay clickable but out of the tab order.
              card = (
                <Link
                  href={href}
                  aria-label={`${section.title} — explore related work${category ? ` in ${category}` : ''}`}
                  tabIndex={isReal ? undefined : -1}
                  className={cn(
                    cardClass,
                    'group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-steel',
                  )}
                  onFocus={(event) => {
                    // Keyboard focus only: a mouse press focuses the link
                    // too, and scrolling then would fight a drag.
                    if (event.currentTarget.matches(':focus-visible')) scrollToSlot(slot)
                  }}
                >
                  {renderCardBody(section, i, false)}
                </Link>
              )
            }

            return (
              <article
                key={`${section.id}-${slot}`}
                ref={(node) => {
                  itemRefs.current[slot] = node
                }}
                aria-hidden={isReal ? undefined : true}
                className="flex min-w-0 shrink-0 grow-0 basis-[88%] snap-center justify-center px-3 sm:basis-[70%] md:basis-[52%] lg:basis-[42%]"
                onFocusCapture={edit && isReal ? () => scrollToSlot(slot) : undefined}
              >
                {card}
              </article>
            )
          })}
          {!looping && <div aria-hidden className="shrink-0 basis-[6%] sm:basis-[15%] md:basis-[24%] lg:basis-[29%]" />}
        </div>
      </div>
      <noscript>
        <style>{'#research-showcase [data-carousel]{opacity:1!important}'}</style>
      </noscript>

      <div className="mt-8 flex justify-center gap-2">
        {content.sections.map((section, i) => (
          <button
            key={section.id}
            type="button"
            aria-label={`Go to ${section.label}`}
            onClick={() => goTo(i)}
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
