'use client'

import { useState, type ComponentType, type MouseEvent } from 'react'
import { Check, Copy, Mail } from 'lucide-react'
import { profile } from '@/lib/content'
import { cn } from '@/lib/utils'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.75 2.68 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.77.12 3.06.74.8 1.19 1.83 1.19 3.09 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .3.21.66.8.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

// Icon button that doesn't go anywhere on click. Hovering it (or tapping it,
// for touch) expands it in place — the text grows out to the right of the
// icon — to reveal the email value, with a copy button. Only email uses
// this: LinkedIn and GitHub are plain links (see IconLink below).
function ContactButton({
  icon: Icon,
  value,
  label,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>
  value: string
  label: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy(event: MouseEvent) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable — the value is still shown, so it can be
      // selected and copied by hand.
    }
  }

  return (
    <div
      className="inline-flex items-center rounded-full text-navy transition-colors hover:bg-secondary"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full', iconClassName)}
      >
        <Icon className="size-5" />
      </button>
      <div
        className={cn(
          'flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs font-medium transition-all duration-500',
          open ? 'max-w-[220px] pr-3 opacity-100' : 'max-w-0 opacity-0',
        )}
      >
        {value}
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          title="Copy"
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors',
            copied ? 'text-emerald-600' : 'text-steel-700 hover:bg-white',
          )}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  )
}

// A plain clickable icon — no hover-expand, just a link that opens in a new
// tab. Used for LinkedIn and GitHub, which link out rather than showing a
// copyable value.
function IconLink({
  icon: Icon,
  href,
  label,
  iconClassName,
}: {
  icon: ComponentType<{ className?: string }>
  href: string
  label: string
  iconClassName?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy transition-colors hover:bg-secondary',
        iconClassName,
      )}
    >
      <Icon className="size-5" />
    </a>
  )
}

export function SocialLinks({
  className,
  iconClassName,
}: {
  className?: string
  iconClassName?: string
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <ContactButton icon={Mail} value={profile.email} label="Email" iconClassName={iconClassName} />
      <IconLink icon={LinkedInIcon} href={profile.linkedinUrl} label="LinkedIn" iconClassName={iconClassName} />
      <IconLink icon={GithubIcon} href={profile.githubUrl} label="GitHub" iconClassName={iconClassName} />
    </div>
  )
}

export { LinkedInIcon, GithubIcon }
