'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { List, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ArticleHeading } from '@/lib/latex-article'

// The article's table of contents, out of the way until it's wanted: a
// "Contents" button fixed to the right side of the screen opens a panel
// (a full-width drawer on phones). Choosing a section scrolls to it and
// closes the panel; so do Escape and a click outside. The section being
// read is highlighted. The button only shows while the reader is in the
// article body (element `bodyId`), not over the title and abstract.
export function ArticleContents({ headings, bodyId }: { headings: ArticleHeading[]; bodyId: string }) {
  const [open, setOpen] = useState(false)
  const [inBody, setInBody] = useState(false)
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // The last heading above the top quarter of the screen.
  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return
    const onScroll = () => {
      const line = window.innerHeight * 0.25
      let current = elements[0].id
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= line) current = element.id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  // In the body = the body overlaps the top 40% of the screen: it has
  // scrolled up into view and its end hasn't gone past.
  useEffect(() => {
    const body = document.getElementById(bodyId)
    if (!body) return
    const observer = new IntersectionObserver(([entry]) => setInBody(entry.isIntersecting), {
      rootMargin: '0px 0px -60% 0px',
    })
    observer.observe(body)
    return () => observer.disconnect()
  }, [bodyId])

  // Leaving the body closes the panel along with the button.
  useEffect(() => {
    if (!inBody) setOpen(false)
  }, [inBody])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  // Escape and clicks outside close the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    // Focus the current section's entry (or the first) when it opens.
    const current = panelRef.current?.querySelector<HTMLAnchorElement>('[aria-current="location"]')
    ;(current ?? panelRef.current?.querySelector<HTMLAnchorElement>('a'))?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  const goTo = (id: string) => {
    setOpen(false)
    const target = document.getElementById(id)
    if (!target) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="print:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-hidden={!inBody || undefined}
        tabIndex={inBody ? undefined : -1}
        className={cn(
          'fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-white/95 px-4 py-2.5 text-sm font-semibold text-navy shadow-lg shadow-navy/10 backdrop-blur transition-[opacity,transform,border-color,background-color] duration-300 hover:border-steel/40 hover:bg-white motion-reduce:transition-none md:bottom-auto md:right-6 md:top-28',
          open && 'border-steel/40',
          inBody ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0',
        )}
      >
        <List aria-hidden className="size-4 text-steel" />
        Contents
      </button>

      {open && (
        <>
          {/* Dims the page behind the drawer on phones. */}
          <div aria-hidden className="fixed inset-0 z-40 bg-navy/25 md:hidden" />
          <div
            ref={panelRef}
            id={panelId}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-2xl border-t border-border bg-white shadow-2xl md:inset-x-auto md:bottom-auto md:right-6 md:top-40 md:max-h-[calc(100vh-12rem)] md:w-80 md:rounded-2xl md:border"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-steel-700">Contents</p>
              <button
                type="button"
                onClick={() => close(true)}
                aria-label="Close contents"
                className="inline-flex size-8 items-center justify-center rounded-full text-navy transition-colors hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav aria-label="Contents" className="overflow-y-auto px-3 py-3">
              <ol className="space-y-0.5">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      aria-current={active === heading.id ? 'location' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        goTo(heading.id)
                      }}
                      className={cn(
                        'flex gap-2.5 rounded-lg py-2 pr-3 text-sm leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-steel/40',
                        heading.level === 1 ? 'pl-3' : 'pl-8',
                        active === heading.id
                          ? 'bg-steel/10 font-semibold text-navy'
                          : 'text-muted-foreground hover:bg-secondary hover:text-navy',
                      )}
                    >
                      {heading.number && <span className="shrink-0 tabular-nums text-steel">{heading.number}</span>}
                      <span dangerouslySetInnerHTML={{ __html: heading.html }} />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
