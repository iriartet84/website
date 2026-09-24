import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Download, Mail } from 'lucide-react'
import { LinkedInIcon } from '@/components/social-links'
import { PageHeader } from '@/components/page-header'
import { EditableBullets, EditableTags, EditableText } from '@/components/admin/editable'
import type {
  PublicCvProfile,
  PublicEducation,
  PublicExperience,
  PublicLanguage,
} from '@/lib/queries'

// The body of the /cv page, moved out of app/cv/page.tsx unchanged so the
// admin CV editor (components/admin/cv-editor.tsx) renders the very same
// layout. Public use passes no `edit` prop.

type ProfileFields = Pick<
  PublicCvProfile,
  'tagline' | 'nationality' | 'location' | 'email' | 'linkedin' | 'programming' | 'methods'
>

export type CvListEdit<T> = {
  onItemChange: (index: number, patch: Partial<T>) => void
  // Lets the editor add its toolbar around an entry, or swap in a
  // "will be deleted" placeholder.
  wrapItem: (index: number, entry: ReactNode) => ReactNode
  after: ReactNode
}

export type CvViewEdit = {
  onProfileChange: (patch: Partial<ProfileFields>) => void
  // Replaces the "Download CV" button: upload/replace/remove the PDF.
  downloadControl: ReactNode
  // Settings with no visible place on the page (LinkedIn URL, phone).
  contactSettings: ReactNode
  education: CvListEdit<PublicEducation>
  experience: CvListEdit<PublicExperience>
  languages: CvListEdit<PublicLanguage>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-8 border-t border-border py-12 md:grid-cols-[220px_1fr] md:py-16">
      <h2 className="font-serif text-2xl tracking-tight text-navy">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

const bulletItem = 'flex gap-3 text-sm leading-relaxed text-muted-foreground'
const bulletDot = 'mt-2 size-1 shrink-0 rounded-full bg-steel'
const skillChip = 'rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700'

function Bullets({
  items,
  onChange,
}: {
  items: string[]
  onChange?: (items: string[]) => void
}) {
  if (onChange) {
    return (
      <EditableBullets
        items={items}
        onChange={onChange}
        listClassName="mt-3 space-y-1.5"
        itemClassName={bulletItem}
        dotClassName={bulletDot}
      />
    )
  }
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((d) => (
        <li key={d} className={bulletItem}>
          <span className={bulletDot} />
          {d}
        </li>
      ))}
    </ul>
  )
}

export function CvView({
  fullName,
  cv,
  education,
  experience,
  languages,
  edit,
}: {
  fullName: string
  cv: PublicCvProfile
  education: PublicEducation[]
  experience: PublicExperience[]
  languages: PublicLanguage[]
  edit?: CvViewEdit
}) {
  const text = (
    value: string,
    label: string,
    onChange: ((value: string) => void) | undefined,
    className?: string,
    as?: 'span' | 'p' | 'h3',
  ) =>
    onChange ? (
      <EditableText as={as} value={value} label={label} className={className} onChange={onChange} />
    ) : !as && !className ? (
      value
    ) : as === 'p' ? (
      <p className={className}>{value}</p>
    ) : as === 'h3' ? (
      <h3 className={className}>{value}</h3>
    ) : (
      <span className={className}>{value}</span>
    )

  const profileSetter = <K extends keyof ProfileFields>(key: K) =>
    edit ? (value: ProfileFields[K]) => edit.onProfileChange({ [key]: value } as Partial<ProfileFields>) : undefined

  return (
    <main>
      <PageHeader
        eyebrow="Curriculum Vitae"
        title={fullName}
        description={cv.tagline}
        edit={
          edit && {
            onChange: (_field, value) => edit.onProfileChange({ tagline: value }),
            readOnly: ['eyebrow', 'title'],
          }
        }
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Quick facts */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 py-8 text-sm">
          <span className="text-muted-foreground">
            Nationality — {text(cv.nationality, 'Nationality', profileSetter('nationality'), 'text-navy')}
          </span>
          <span className="text-muted-foreground">
            Based in — {text(cv.location, 'Based in', profileSetter('location'), 'text-navy')}
          </span>
          {edit ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-navy">
                <Mail className="size-4" />
                <EditableText value={cv.email} label="Email" onChange={(email) => edit.onProfileChange({ email })} />
              </span>
              <span className="inline-flex items-center gap-1.5 text-navy">
                <LinkedInIcon className="size-4" />
                <EditableText
                  value={cv.linkedin}
                  label="LinkedIn (display text)"
                  onChange={(linkedin) => edit.onProfileChange({ linkedin })}
                />
              </span>
              {edit.contactSettings}
              <span className="ml-auto">{edit.downloadControl}</span>
            </>
          ) : (
            <>
              <a
                href={`mailto:${cv.email}`}
                className="inline-flex items-center gap-1.5 text-navy hover:opacity-70"
              >
                <Mail className="size-4" />
                {cv.email}
              </a>
              <a
                href={cv.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-navy hover:opacity-70"
              >
                <LinkedInIcon className="size-4" />
                {cv.linkedin}
              </a>
              {cv.cvPdfUrl && (
                <a
                  href={cv.cvPdfUrl}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy-800"
                >
                  <Download className="size-3.5" />
                  Download CV
                </a>
              )}
            </>
          )}
        </div>

        <Section title="Education">
          <div className="space-y-8">
            {education.map((e, index) => {
              const set = edit
                ? (patch: Partial<PublicEducation>) => edit.education.onItemChange(index, patch)
                : undefined
              const entry = (
                <div key={edit ? undefined : e.school}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    {text(e.school, 'School', set && ((school) => set({ school })), 'text-lg font-medium text-navy', 'h3')}
                    {text(e.period, 'Period', set && ((period) => set({ period })), 'text-sm text-muted-foreground')}
                  </div>
                  {text(e.location, 'Location', set && ((location) => set({ location })), 'mt-0.5 text-sm text-muted-foreground', 'p')}
                  {text(e.degree, 'Degree', set && ((degree) => set({ degree })), 'mt-2 text-sm text-navy', 'p')}
                  <Bullets items={e.details} onChange={set && ((details) => set({ details }))} />
                </div>
              )
              return edit ? <div key={index}>{edit.education.wrapItem(index, entry)}</div> : entry
            })}
            {edit?.education.after}
          </div>
        </Section>

        <Section title="Professional Experience">
          <div className="space-y-10">
            {experience.map((x, index) => {
              const set = edit
                ? (patch: Partial<PublicExperience>) => edit.experience.onItemChange(index, patch)
                : undefined
              const entry = (
                <div key={edit ? undefined : `${x.org}-${x.period}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h3 className="text-lg font-medium text-navy">
                      {text(x.org, 'Organisation', set && ((org) => set({ org })))}{' '}
                      <span className="text-muted-foreground">
                        — {text(x.role, 'Role', set && ((role) => set({ role })))}
                      </span>
                    </h3>
                    {text(x.period, 'Period', set && ((period) => set({ period })), 'text-sm text-muted-foreground')}
                  </div>
                  <p className="mt-0.5 text-sm italic text-muted-foreground">
                    {text(x.summary, 'Summary', set && ((summary) => set({ summary })))} ·{' '}
                    {text(x.location, 'Location', set && ((location) => set({ location })))}
                  </p>
                  <Bullets items={x.details} onChange={set && ((details) => set({ details }))} />
                </div>
              )
              return edit ? <div key={index}>{edit.experience.wrapItem(index, entry)}</div> : entry
            })}
            {edit?.experience.after}
          </div>
        </Section>

        <Section title="Technical Skills">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-navy">Programming & Tools</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {edit ? (
                  <EditableTags
                    tags={cv.programming}
                    chipClassName={skillChip}
                    label="skill"
                    onChange={(programming) => edit.onProfileChange({ programming })}
                  />
                ) : (
                  cv.programming.map((s) => (
                    <span key={s} className={skillChip}>
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-navy">
                Econometric & ML Methods
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {edit ? (
                  <EditableTags
                    tags={cv.methods}
                    chipClassName={skillChip}
                    label="method"
                    onChange={(methods) => edit.onProfileChange({ methods })}
                  />
                ) : (
                  cv.methods.map((s) => (
                    <span key={s} className={skillChip}>
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Languages">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {languages.map((l, index) => {
              const set = edit
                ? (patch: Partial<PublicLanguage>) => edit.languages.onItemChange(index, patch)
                : undefined
              const card = (
                <div
                  key={edit ? undefined : l.name}
                  className={edit ? 'h-full rounded-xl bg-white p-4 shadow-sm shadow-navy/5' : 'rounded-xl bg-white p-4 shadow-sm shadow-navy/5'}
                >
                  {text(l.name, 'Language', set && ((name) => set({ name })), 'text-sm font-medium text-navy', 'p')}
                  {text(l.level, 'Level', set && ((level) => set({ level })), 'mt-0.5 text-xs text-muted-foreground', 'p')}
                </div>
              )
              return edit ? <div key={index}>{edit.languages.wrapItem(index, card)}</div> : card
            })}
            {edit?.languages.after}
          </div>
        </Section>

        <div className="border-t border-border py-12 md:py-16">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-navy p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
            <div>
              <h2 className="font-serif text-2xl tracking-tight md:text-3xl">
                Selected projects live on the site
              </h2>
              <p className="mt-2 max-w-lg text-sm text-white/70">
                Interactive maps, forecasting dashboards, and quantitative tools
                are deployed in the Projects section.
              </p>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-navy transition-transform hover:-translate-y-0.5"
            >
              View projects
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
