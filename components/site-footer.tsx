import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { profile } from '@/lib/content'
import { LinkedInIcon } from '@/components/social-links'

const links = [
  { href: '/projects', label: 'Projects' },
  { href: '/papers', label: 'Papers & Briefs' },
  { href: '/cv', label: 'CV' },
]

const contactLinkClass =
  'inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-navy'

export function SiteFooter() {
  return (
    <footer id="site-footer" className="border-t border-border bg-white print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl tracking-tight text-navy">
            {profile.name}
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Economist — commodity, macroeconomic, financial markets, and
            geopolitical risk research.
          </p>
        </div>

        <nav className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-steel-700">Site</p>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={contactLinkClass}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-steel-700">Contact</p>
          <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className={contactLinkClass}>
            <LinkedInIcon className="size-3.5 shrink-0" />
            {profile.linkedin}
          </a>
          <a href={`mailto:${profile.email}`} className={contactLinkClass}>
            <Mail className="size-3.5 shrink-0" />
            {profile.email}
          </a>
          <a href={`tel:${profile.phone.replace(/[^+0-9]/g, '')}`} className={contactLinkClass}>
            <Phone className="size-3.5 shrink-0" />
            {profile.phone}
          </a>
        </div>
      </div>
    </footer>
  )
}
