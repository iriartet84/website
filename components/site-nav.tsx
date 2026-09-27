'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SocialLinks } from '@/components/social-links'

const links = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/papers', label: 'Papers & Briefs' },
  { href: '/cv', label: 'CV' },
]

// At rest: regular weight, in the same near-black as page titles. The
// current page keeps its bold label on the site's slate-blue chip (--steel);
// hovering shows a lighter chip.
const navPill = 'rounded-full px-4 py-2 text-sm transition-colors'
const navPillActive = 'bg-steel/20 font-bold text-navy'
const navPillInactive = 'font-normal text-navy hover:bg-steel/10'

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
      // Hide the header only once the footer comes into view — it repeats
      // the same nav links, so the header would be redundant there. Not
      // tied to the Research Focus carousel, or any other section.
      const footer = document.getElementById('site-footer')
      setHidden(footer ? footer.getBoundingClientRect().top < window.innerHeight : false)
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
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out print:hidden',
        hidden ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100',
        scrolled
          ? 'border-b border-border/70 bg-white/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="relative mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
        <div className="hidden items-center gap-1 md:absolute md:left-1/2 md:flex md:-translate-x-1/2">
          {links.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(navPill, active ? navPillActive : navPillInactive)}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SocialLinks className="hidden sm:flex" />
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
                    active ? navPillActive : 'font-normal text-navy hover:bg-secondary',
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
