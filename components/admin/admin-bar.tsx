'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { confirmLeaveWithUnsavedChanges } from '@/components/admin/unsaved-guard'

// Top bar for every /admin page. Each tab edits the public page of the same
// name; "View live page" opens the public version of the page being edited.
export const adminPages = [
  { href: '/admin/home', label: 'Home', publicHref: '/' },
  { href: '/admin/papers', label: 'Papers & Briefs', publicHref: '/papers' },
  { href: '/admin/projects', label: 'Projects', publicHref: '/projects' },
  { href: '/admin/cv', label: 'CV', publicHref: '/cv' },
] as const

export function AdminBar({ email }: { email: string }) {
  const pathname = usePathname()
  const current = adminPages.find((page) => pathname.startsWith(page.href))

  const guard = (event: React.MouseEvent) => {
    if (!confirmLeaveWithUnsavedChanges()) event.preventDefault()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link
          href="/admin"
          onClick={guard}
          className="shrink-0 font-serif text-lg tracking-tight text-navy hover:opacity-70"
        >
          Site editor
        </Link>

        <nav aria-label="Pages" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {adminPages.map((page) => {
            const active = current?.href === page.href
            return (
              <Link
                key={page.href}
                href={page.href}
                onClick={guard}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-navy font-medium text-white'
                    : 'text-muted-foreground hover:bg-secondary hover:text-navy',
                )}
              >
                {page.label}
              </Link>
            )
          })}
        </nav>

        <a
          href={current?.publicHref ?? '/'}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-navy transition-colors hover:bg-secondary sm:inline-flex"
        >
          View live page
          <ArrowUpRight className="size-3.5" />
        </a>
        <span className="hidden truncate text-xs text-muted-foreground lg:block" title={email}>
          {email}
        </span>
      </div>
    </header>
  )
}

// Thin strip under the bar on each editor page, saying which public page is
// being edited and how editing works.
export function EditingBanner({ page, children }: { page: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-steel/20 bg-steel/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 text-xs text-steel-700 sm:px-8">
        <span className="font-semibold uppercase tracking-[0.14em]">Editing: {page}</span>
        <span className="text-muted-foreground">
          This is the page as visitors see it. Click any outlined text to edit it; use the toolbars to
          reorder, hide or delete. Nothing is public until you save.
        </span>
        {children}
      </div>
    </div>
  )
}
