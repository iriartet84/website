import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EditableText } from '@/components/admin/editable'
import { cn } from '@/lib/utils'
import type { HomeContent } from '@/lib/site-content-shared'

type HeroContent = HomeContent['hero']
type HeroTextField = Exclude<keyof HeroContent, 'photo' | 'background'>

const photoShapes = {
  portrait: 'aspect-[3/4] rounded-2xl md:rounded-3xl',
  square: 'aspect-square rounded-2xl md:rounded-3xl',
  circle: 'aspect-square rounded-full',
} as const

const photoAlign = { top: 'md:self-start', center: 'md:self-center', bottom: 'md:self-end' } as const

// `edit` is only passed by the admin Home editor (components/admin/home-editor.tsx).
// The photo and background settings (image, size, position, framing) live
// in `content.photo` / `content.background`; the editor overlays its own
// controls on them through `photoControl` / `backgroundControl`.
export function Hero({
  content,
  edit,
}: {
  content: HeroContent
  edit?: {
    onChange: (field: HeroTextField, value: string) => void
    photoControl?: ReactNode
    backgroundControl?: ReactNode
  }
}) {
  const primaryClass =
    'inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-navy-800'
  const secondaryClass =
    'inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium text-navy transition-colors hover:bg-secondary'

  const { photo, background } = content
  const showPhoto = Boolean(photo.image) || Boolean(edit)
  const photoLeft = photo.side === 'left'
  const name = [content.firstName, content.lastName].filter(Boolean).join(' ')

  // Zoom scales around the focal point, so the point stays put.
  const photoStyle: CSSProperties = {
    objectPosition: `${photo.focusX}% ${photo.focusY}%`,
    transformOrigin: `${photo.focusX}% ${photo.focusY}%`,
    transform: photo.zoom !== 100 ? `scale(${photo.zoom / 100})` : undefined,
  }
  const backgroundStyle: CSSProperties = {
    opacity: background.opacity / 100,
    objectPosition: `${background.positionX}% ${background.positionY}%`,
    transformOrigin: `${background.positionX}% ${background.positionY}%`,
    transform: background.zoom !== 100 ? `scale(${background.zoom / 100})` : undefined,
  }

  return (
    <section className="relative flex min-h-[68vh] flex-col justify-center overflow-hidden bg-background pb-16 pt-24 md:min-h-[72vh] md:pb-20 md:pt-28">
      {/* The background (by default a yield-curve surface — the term
          structure over time — as a faint wireframe, public/hero/). With
          `fade` it shows only along the bottom and fades out upwards, so
          it never sits behind the copy. */}
      {background.image && (
        <img
          src={background.image}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          style={backgroundStyle}
          className={cn(
            'pointer-events-none absolute inset-0 size-full max-w-none select-none object-cover',
            background.fade && 'hero-background-fade',
          )}
        />
      )}
      {edit?.backgroundControl}

      <div
        className={cn(
          'relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 md:gap-14 lg:gap-20',
          showPhoto
            ? photoLeft
              ? 'md:grid-cols-[auto_minmax(0,1fr)]'
              : 'md:grid-cols-[minmax(0,1fr)_auto]'
            : undefined,
        )}
      >
        <div className={cn('order-2', photoLeft ? 'md:order-2' : 'md:order-1')}>
          <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-navy sm:text-6xl lg:text-7xl">
            {edit ? (
              <>
                <EditableText
                  value={content.firstName}
                  label="First name"
                  onChange={(value) => edit.onChange('firstName', value)}
                />{' '}
                <EditableText
                  value={content.lastName}
                  label="Last name (highlighted)"
                  className="text-steel-700"
                  onChange={(value) => edit.onChange('lastName', value)}
                />
              </>
            ) : (
              <>
                {content.firstName}
                {content.lastName && (
                  <>
                    {' '}
                    <span className="text-steel-700">{content.lastName}</span>
                  </>
                )}
              </>
            )}
          </h1>

          {edit ? (
            <EditableText
              as="p"
              value={content.tagline}
              label="Tagline"
              multiline
              className="mt-6 block max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
              onChange={(value) => edit.onChange('tagline', value)}
            />
          ) : (
            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              {content.tagline}
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {edit ? (
              <>
                <span className={primaryClass}>
                  <EditableText
                    value={content.primaryCta}
                    label="Primary button label (links to Projects)"
                    onChange={(value) => edit.onChange('primaryCta', value)}
                  />
                  <ArrowRight className="size-4" />
                </span>
                <span className={secondaryClass}>
                  <EditableText
                    value={content.secondaryCta}
                    label="Secondary button label (links to Papers)"
                    onChange={(value) => edit.onChange('secondaryCta', value)}
                  />
                </span>
              </>
            ) : (
              <>
                <Link href="/projects" className={primaryClass}>
                  {content.primaryCta}
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/papers" className={secondaryClass}>
                  {content.secondaryCta}
                </Link>
              </>
            )}
          </div>
        </div>

        {showPhoto && (
          <figure
            // Width on tablet/desktop comes from the settings (capped so it
            // never crowds the text); phones use a fixed small size.
            style={{ '--hero-photo-width': `${photo.width}px` } as CSSProperties}
            className={cn(
              'relative order-1 w-32 shrink-0 sm:w-40 md:w-[min(var(--hero-photo-width),36vw)]',
              photoLeft ? 'md:order-1' : 'md:order-2',
              photoAlign[photo.align],
            )}
          >
            <div
              className={cn(
                'overflow-hidden bg-secondary shadow-xl shadow-navy/10',
                photoShapes[photo.shape],
                !photo.image && 'border-2 border-dashed border-steel/30 bg-transparent shadow-none',
              )}
            >
              {photo.image && (
                <img
                  src={photo.image}
                  alt={`Portrait of ${name}`}
                  width={720}
                  height={960}
                  fetchPriority="high"
                  draggable={false}
                  style={photoStyle}
                  className="size-full object-cover"
                />
              )}
            </div>
            {edit?.photoControl}
          </figure>
        )}
      </div>
    </section>
  )
}
