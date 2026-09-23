import type { Metadata } from 'next'
import { Mail, Phone, MapPin, ArrowUpRight } from 'lucide-react'
import { LinkedInIcon } from '@/components/social-links'
import { PageHeader } from '@/components/page-header'
import { profile } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with Toribio Iriarte — email, phone, and LinkedIn.',
}

const channels = [
  {
    icon: Mail,
    label: 'Email',
    value: profile.email,
    href: `mailto:${profile.email}`,
  },
  {
    icon: Phone,
    label: 'Phone',
    value: profile.phone,
    href: `tel:${profile.phone.replace(/\s/g, '')}`,
  },
  {
    icon: LinkedInIcon,
    label: 'LinkedIn',
    value: profile.linkedin,
    href: profile.linkedinUrl,
  },
  {
    icon: MapPin,
    label: 'Location',
    value: profile.location,
    href: undefined,
  },
]

export default function ContactPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Let’s talk"
        description="Open to research collaborations, policy work, and roles across macroeconomics, commodities, financial markets, and geopolitical risk."
      />

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {channels.map((c) => {
            const Icon = c.icon
            const inner = (
              <>
                <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-navy">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-0.5 truncate text-base text-navy">{c.value}</p>
                </div>
                {c.href && (
                  <ArrowUpRight className="ml-auto size-5 text-muted-foreground transition-colors group-hover:text-navy" />
                )}
              </>
            )

            const className =
              'group flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5 transition-colors hover:shadow-md hover:shadow-navy/10'

            return c.href ? (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className={className}
              >
                {inner}
              </a>
            ) : (
              <div key={c.label} className={className}>
                {inner}
              </div>
            )
          })}
        </div>

        <div className="mt-12 rounded-2xl bg-navy p-8 text-white md:p-12">
          <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
            {profile.fullName}
          </h2>
          <p className="mt-3 max-w-xl text-white/70">{profile.tagline}</p>
          <a
            href={`mailto:${profile.email}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-navy transition-transform hover:-translate-y-0.5"
          >
            <Mail className="size-4" />
            Send an email
          </a>
        </div>
      </div>
    </main>
  )
}
