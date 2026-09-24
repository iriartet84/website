import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Download, Mail } from 'lucide-react'
import { LinkedInIcon } from '@/components/social-links'
import { PageHeader } from '@/components/page-header'
import { profile } from '@/lib/content'
import {
  getPublishedExperience,
  getPublishedEducation,
  getPublishedLanguages,
  getCvProfile,
} from '@/lib/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'CV',
  description:
    'Full curriculum vitae: education, professional experience, technical skills, and languages.',
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-8 border-t border-border py-12 md:grid-cols-[220px_1fr] md:py-16">
      <h2 className="font-serif text-2xl tracking-tight text-navy">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

export default async function CvPage() {
  const [experience, education, languages, cv] = await Promise.all([
    getPublishedExperience(),
    getPublishedEducation(),
    getPublishedLanguages(),
    getCvProfile(),
  ])

  return (
    <main>
      <PageHeader
        eyebrow="Curriculum Vitae"
        title={profile.fullName}
        description={cv.tagline}
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Quick facts */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 py-8 text-sm">
          <span className="text-muted-foreground">
            Nationality — <span className="text-navy">{cv.nationality}</span>
          </span>
          <span className="text-muted-foreground">
            Based in — <span className="text-navy">{cv.location}</span>
          </span>
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
        </div>

        <Section title="Education">
          <div className="space-y-8">
            {education.map((e) => (
              <div key={e.school}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="text-lg font-medium text-navy">{e.school}</h3>
                  <span className="text-sm text-muted-foreground">{e.period}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {e.location}
                </p>
                <p className="mt-2 text-sm text-navy">{e.degree}</p>
                <ul className="mt-3 space-y-1.5">
                  {e.details.map((d) => (
                    <li
                      key={d}
                      className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-steel" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Professional Experience">
          <div className="space-y-10">
            {experience.map((x) => (
              <div key={`${x.org}-${x.period}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="text-lg font-medium text-navy">
                    {x.org}{' '}
                    <span className="text-muted-foreground">— {x.role}</span>
                  </h3>
                  <span className="text-sm text-muted-foreground">{x.period}</span>
                </div>
                <p className="mt-0.5 text-sm italic text-muted-foreground">
                  {x.summary} · {x.location}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {x.details.map((d) => (
                    <li
                      key={d}
                      className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-steel" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Technical Skills">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-navy">Programming & Tools</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cv.programming.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-navy">
                Econometric & ML Methods
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cv.methods.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-steel/10 px-3 py-1 text-xs font-medium text-steel-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Languages">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {languages.map((l) => (
              <div
                key={l.name}
                className="rounded-xl bg-white p-4 shadow-sm shadow-navy/5"
              >
                <p className="text-sm font-medium text-navy">{l.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{l.level}</p>
              </div>
            ))}
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
