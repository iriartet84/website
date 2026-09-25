import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { eq } from 'drizzle-orm'
import {
  listAdminPapers,
  listAdminProjects,
  listAdminExperience,
  listAdminEducation,
  listAdminLanguages,
  getAdminCvProfile,
} from '@/lib/queries'
import { db } from '@/lib/db'
import { siteContent } from '@/lib/db/schema'
import { isS3Configured } from '@/lib/blobs'
import { outputHealth } from '@/lib/project-meta'
import { parseProjectOutput } from '@/lib/project-output'

// Admin overview: one card per editable public page. The editors themselves
// live at /admin/home, /admin/papers, /admin/projects and /admin/cv.

async function safely<T>(fn: () => Promise<T>, fallback: T): Promise<{ value: T; failed: boolean }> {
  try {
    return { value: await fn(), failed: false }
  } catch {
    return { value: fallback, failed: true }
  }
}

function countLabel(rows: { published: boolean }[], noun: string) {
  const hidden = rows.filter((row) => !row.published).length
  const shown = rows.length - hidden
  if (rows.length === 0) return `No ${noun}s saved yet — the public page shows the built-in examples`
  return `${shown} published${hidden ? ` · ${hidden} hidden` : ''}`
}

type HubProject = {
  published: boolean
  featured: boolean
  outputUrl: string | null
  output: unknown
  outputError: string | null
  updateFrequency: string | null
}

function projectStatus(rows: HubProject[]) {
  const parts = [countLabel(rows, 'project')]
  const featured = rows.filter((row) => row.published && row.featured).length
  if (featured) parts.push(`${featured} featured`)
  const health = rows.map((row) =>
    outputHealth({ ...row, output: parseProjectOutput(row.output).data ?? null }),
  )
  const failing = health.filter((h) => h === 'failing').length
  const overdue = health.filter((h) => h === 'overdue').length
  if (failing) parts.push(`${failing} with failing live data`)
  if (overdue) parts.push(`${overdue} overdue`)
  return parts.join(' · ')
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const [papers, projects, experience, education, languages, cv, home] = await Promise.all([
    safely(listAdminPapers, []),
    safely(listAdminProjects, []),
    safely(listAdminExperience, []),
    safely(listAdminEducation, []),
    safely(listAdminLanguages, []),
    safely(getAdminCvProfile, null),
    safely(
      async () =>
        (
          await db
            .select({ updatedAt: siteContent.updatedAt })
            .from(siteContent)
            .where(eq(siteContent.key, 'home'))
            .limit(1)
        )[0] ?? null,
      null,
    ),
  ])

  const cvEntries = experience.value.length + education.value.length + languages.value.length
  const cards = [
    {
      href: '/admin/home',
      title: 'Home',
      description:
        'Hero introduction, Featured Projects (or the Research Focus carousel while none is featured) and the Skillset cards.',
      status: home.failed
        ? 'Could not load — has `npm run db:push` been run for site_content?'
        : home.value
          ? `Last saved ${home.value.updatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'Showing the built-in content — edit and save to customise',
    },
    {
      href: '/admin/papers',
      title: 'Papers & Briefs',
      description: 'Add, edit, reorder, hide or delete papers, reports and briefs, and their PDFs.',
      status: papers.failed ? 'Could not load papers' : countLabel(papers.value, 'paper'),
    },
    {
      href: '/admin/projects',
      title: 'Projects',
      description:
        'Project cards (sector, type, languages, APIs, featured on Home) and each project’s page: write-up, charts, links, live data and document.',
      status: projects.failed
        ? 'Could not load projects'
        : projects.value.length === 0
          ? 'No projects yet — the public page shows “coming soon”'
          : projectStatus(projects.value),
    },
    {
      href: '/admin/cv',
      title: 'CV',
      description: 'Description, contact details, education, experience, skills, languages and the CV PDF.',
      status: cv.failed
        ? 'Could not load the CV'
        : `${cvEntries} entries · ${cv.value?.cvPdfPathname ? `PDF: ${cv.value.cvPdfFilename ?? 'uploaded'}` : 'no PDF uploaded — download button hidden'}`,
    },
  ]

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 md:py-16">
      {error && (
        <p className="mb-8 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">Site editor</p>
      <h1 className="mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl">
        Which page do you want to edit?
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Each editor shows the page exactly as visitors see it, with editing controls on top. Changes
        stay a preview until you press Save.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-2xl bg-white p-6 shadow-sm shadow-navy/5 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/10"
          >
            <h2 className="font-serif text-2xl tracking-tight text-navy transition-colors group-hover:text-steel-700">
              {card.title}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{card.status}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-steel-700 group-hover:text-navy">
                Edit page
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        File storage:{' '}
        {isS3Configured()
          ? 'private S3-compatible bucket (uploads go straight from your browser; downloads use short-lived presigned links).'
          : 'no bucket configured — files are stored with the fallback storage (Netlify Blobs / local disk).'}
      </p>
    </main>
  )
}
