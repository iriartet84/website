'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { profile } from '@/lib/content'
import { SocialLinks } from '@/components/social-links'

const links = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/papers', label: 'Papers & Briefs' },
  { href: '/cv', label: 'CV' },
]

export function SiteNav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      const showcase = document.getElementById('research-showcase')
      if (showcase) {
        const rect = showcase.getBoundingClientRect()
        // Hide the header while the pinned showcase occupies the viewport.
        setHidden(rect.top <= 4 && rect.bottom >= window.innerHeight - 4)
      } else {
        setHidden(false)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out',
        hidden ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
        scrolled
          ? 'border-b border-border/70 bg-white/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="font-serif text-lg tracking-tight text-navy hover:opacity-70 transition-opacity"
        >
          {profile.name}
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                  active
                    ? 'text-navy'
                    : 'text-muted-foreground hover:text-navy',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <SocialLinks className="hidden sm:flex" />
          <Link
            href="/contact"
            className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-navy-800"
          >
            Contact
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="flex size-9 items-center justify-center rounded-full text-navy transition-colors hover:bg-secondary md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8">
            {links.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-secondary text-navy'
                      : 'text-muted-foreground hover:text-navy',
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
            <div className="px-2 py-3">
              <SocialLinks />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
