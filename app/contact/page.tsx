import type { ComponentType, ReactNode } from 'react'
import type { Metadata } from 'next'
import { Mail, Phone, MapPin, ArrowUpRight, Check, Copy } from 'lucide-react'
import { LinkedInIcon, WhatsAppIcon } from '@/components/social-links'
import { CopyButton } from '@/components/copy-button'
import { PageHeader } from '@/components/page-header'
import { profile, whatsappUrl } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with Toribio Iriarte — email, phone, and LinkedIn.',
}

// Email and phone copy to the clipboard (no mailto:/tel:); WhatsApp and
// LinkedIn open in a new tab; location is plain text.
type Channel = {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  // Set for values copied on click (the accessible "what": "email address").
  copy?: string
  href?: string
}

const channels: Channel[] = [
  {
    icon: Mail,
    label: 'Email',
    value: profile.email,
    copy: 'email address',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: profile.phone,
    copy: 'phone number',
  },
  {
    icon: WhatsAppIcon,
    label: 'WhatsApp',
    value: 'Start a conversation',
    href: whatsappUrl,
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
            const inner = (trailing?: ReactNode) => (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-navy">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-0.5 truncate text-base text-navy">{c.value}</p>
                </div>
                {trailing}
              </>
            )

            const className =
              'group flex w-full items-center gap-4 rounded-2xl bg-white p-6 shadow-sm shadow-navy/5 transition-colors hover:shadow-md hover:shadow-navy/10'
            const trailingIcon = 'ml-auto size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-navy'

            if (c.copy) {
              return (
                <CopyButton
                  key={c.label}
                  value={c.value}
                  label={c.copy}
                  className={className}
                  wrapperClassName="w-full"
                  copiedChildren={inner(<Check className={`${trailingIcon} text-emerald-600 group-hover:text-emerald-600`} />)}
                >
                  {inner(<Copy className={trailingIcon} />)}
                </CopyButton>
              )
            }
            if (c.href) {
              return (
                <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className={className}>
                  {inner(<ArrowUpRight className={trailingIcon} />)}
                </a>
              )
            }
            return (
              <div key={c.label} className={className}>
                {inner()}
              </div>
            )
          })}
        </div>

        <div className="mt-12 rounded-2xl bg-navy p-8 text-white md:p-12">
          <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
            {profile.fullName}
          </h2>
          <p className="mt-3 max-w-xl text-white/70">{profile.tagline}</p>
          <div className="mt-8">
            <CopyButton
              value={profile.email}
              label="email address"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-navy transition-transform hover:-translate-y-0.5"
              copiedChildren={
                <>
                  <Check className="size-4 text-emerald-600" />
                  Email address copied
                </>
              }
            >
              <Mail className="size-4" />
              {profile.email}
            </CopyButton>
          </div>
        </div>
      </div>
    </main>
  )
}
