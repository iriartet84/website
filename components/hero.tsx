import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EditableText } from '@/components/admin/editable'
import type { HomeContent } from '@/lib/site-content-shared'

type HeroContent = HomeContent['hero']

// `edit` is only passed by the admin Home editor (components/admin/home-editor.tsx).
export function Hero({
  content,
  edit,
}: {
  content: HeroContent
  edit?: { onChange: (field: keyof HeroContent, value: string) => void }
}) {
  const primaryClass =
    'inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-navy-800'
  const secondaryClass =
    'inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium text-navy transition-colors hover:bg-secondary'

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(to right, oklch(0.9 0.008 260 / 0.6) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.9 0.008 260 / 0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 100%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-steel/10 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-steel-700">
          <span className="size-1.5 rounded-full bg-steel" />
          {edit ? (
            <EditableText
              value={content.eyebrow}
              label="Hero eyebrow"
              onChange={(value) => edit.onChange('eyebrow', value)}
            />
          ) : (
            content.eyebrow
          )}
        </p>

        <h1 className="font-serif text-3xl leading-tight tracking-tight text-navy sm:text-4xl">
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
    </section>
  )
}
