import Link from 'next/link'
import { profile } from '@/lib/content'
import { SocialLinks } from '@/components/social-links'

const links = [
  { href: '/projects', label: 'Projects' },
  { href: '/papers', label: 'Papers & Briefs' },
  { href: '/cv', label: 'CV' },
  { href: '/contact', label: 'Contact' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-serif text-2xl tracking-tight text-navy">
            {profile.name}
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Economist — commodity, macroeconomic, financial markets, and
            geopolitical risk research.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-navy"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <SocialLinks />
        </div>
      </div>
    </footer>
  )
}
