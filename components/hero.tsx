import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { profile } from '@/lib/content'

export function Hero() {
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
          Graduate Economist
        </p>

        <h1 className="font-serif text-3xl leading-tight tracking-tight text-navy sm:text-4xl">
          Toribio <span className="text-steel-700">Iriarte</span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          {profile.tagline}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-navy-800"
          >
            View projects
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/papers"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-medium text-navy transition-colors hover:bg-secondary"
          >
            Papers &amp; briefs
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-2 text-muted-foreground">
        <span className="text-xs uppercase tracking-[0.25em]">Scroll</span>
        <ChevronDown className="size-4 animate-bounce" />
      </div>
    </section>
  )
}
