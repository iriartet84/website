'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditableText } from '@/components/admin/editable'
import { ProjectLivePanel } from '@/components/project-card'
import { StackChips, TypeLine } from '@/components/project-badges'
import type { HomeContent } from '@/lib/site-content-shared'
import type { PublicProject } from '@/lib/public-content'

type FeaturedContent = HomeContent['featured']

const ROTATE_MS = 7000

// Home's Featured Projects: one tab per sector, each showing that sector's
// featured project. The tabs advance on their own every few seconds until a
// visitor picks one (or presses pause); hovering or focusing the section
// pauses it, and with reduced motion requested it never moves.
export function FeaturedProjects({
  content,
  projects,
  edit,
}: {
  content: FeaturedContent
  projects: PublicProject[]
  edit?: {
    onHeaderChange: (field: 'eyebrow' | 'heading', value: string) => void
    headerActions?: ReactNode
  }
}) {
  const baseId = useId()
  const [index, setIndex] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // Assume reduced motion until the browser says otherwise, so nothing
  // moves before hydration.
  const [reduced, setReduced] = useState(true)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const count = projects.length
  const current = projects[Math.min(index, count - 1)]

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const canRotate = count > 1 && !reduced && !edit
  const running = canRotate && !stopped && !hovered && !focused

  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS)
    return () => window.clearTimeout(timer)
  }, [running, index, count])

  if (!current) return null

  function choose(next: number, focus = false) {
    setStopped(true)
    setIndex(next)
    if (focus) tabRefs.current[next]?.focus()
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }
    if (event.key in keys) {
      event.preventDefault()
      choose(keys[event.key], true)
    }
  }

  const tabId = (i: number) => `${baseId}-tab-${i}`
  const panelId = `${baseId}-panel`

  return (
    <section
      id="featured-projects"
      aria-label="Featured projects"
      className="bg-white py-20 md:py-28"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            {edit ? (
              <>
                <EditableText
                  as="p"
                  value={content.eyebrow}
                  label="Featured eyebrow"
                  className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700"
                  onChange={(value) => edit.onHeaderChange('eyebrow', value)}
                />
                <EditableText
                  as="h2"
                  value={content.heading}
                  label="Featured heading"
                  className="mt-3 font-serif text-3xl tracking-tight text-navy md:text-4xl"
                  onChange={(value) => edit.onHeaderChange('heading', value)}
                />
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">{content.eyebrow}</p>
                <h2 className="mt-3 font-serif text-3xl tracking-tight text-navy md:text-4xl">{content.heading}</h2>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {edit?.headerActions}
            <Link href="/projects" className="text-sm font-semibold text-steel-700 transition-colors hover:text-navy">
              All projects &rarr;
            </Link>
          </div>
        </div>

        {count > 1 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Featured project by sector" className="flex flex-wrap gap-2">
              {projects.map((project, i) => {
                const selected = i === index
                return (
                  <button
                    key={project.slug}
                    ref={(node) => {
                      tabRefs.current[i] = node
                    }}
                    type="button"
                    role="tab"
                    id={tabId(i)}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => choose(i)}
                    onKeyDown={onTabKeyDown}
                    className={cn(
                      'relative overflow-hidden rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      selected ? 'bg-navy text-white' : 'bg-secondary text-muted-foreground hover:text-navy',
                    )}
                  >
                    {project.category}
                    {selected && running && (
                      <span
                        key={`${index}-${running}`}
                        aria-hidden
                        className="featured-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/60"
                        style={{ animationDuration: `${ROTATE_MS}ms` }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            {canRotate && (
              <button
                type="button"
                onClick={() => setStopped((value) => !value)}
                aria-label={stopped ? 'Resume rotating featured projects' : 'Pause rotating featured projects'}
                title={stopped ? 'Resume' : 'Pause'}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-navy"
              >
                {stopped ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            )}
          </div>
        )}

        <div
          id={panelId}
          role={count > 1 ? 'tabpanel' : undefined}
          aria-labelledby={count > 1 ? tabId(index) : undefined}
          className={count > 1 ? 'mt-6' : 'mt-10'}
        >
          <FeaturedPreview key={current.slug} project={current} linked={!edit} />
        </div>
      </div>
    </section>
  )
}

function FeaturedPreview({ project, linked }: { project: PublicProject; linked: boolean }) {
  const body = (
    <>
      <div className="relative min-h-72 overflow-hidden bg-navy md:col-span-3 md:min-h-80">
        <ProjectLivePanel project={project} variant="feature" />
      </div>
      <div className="flex flex-col p-6 md:col-span-2 md:p-8">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-steel-700">{project.category}</span>
        <TypeLine
          className="mt-2"
          projectType={project.projectType}
          mode={project.mode}
          updateFrequency={project.updateFrequency}
        />
        <h3 className="mt-4 font-serif text-2xl leading-snug tracking-tight text-navy transition-colors group-hover:text-steel-700 md:text-3xl">
          {project.title}
        </h3>
        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
        <StackChips languages={project.languages} apis={project.apis} className="mt-5" />
        <span className="mt-auto pt-6 text-sm font-semibold text-steel-700 transition-colors group-hover:text-navy">
          View project &rarr;
        </span>
      </div>
    </>
  )
  const className =
    'group grid overflow-hidden rounded-3xl bg-secondary motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 md:grid-cols-5'
  return linked ? (
    <Link href={`/projects/${project.slug}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
