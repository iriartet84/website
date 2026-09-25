import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectEntries } from '@/lib/db/schema'
import { parseTags } from '@/lib/validations'
import { parseProjectOutput } from '@/lib/project-output'
import {
  parseEmbedOrigins,
  projectLinkSchema,
  projectSectionSchema,
  stackListSchema,
  type ProjectLink,
  type ProjectSection,
} from '@/lib/project-meta'
import { ProjectPageEditor, type ProjectPageEditorData } from '@/components/admin/project-page-editor'

export const metadata = { title: 'Edit project page' }

function validItems<T>(value: unknown, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = schema.safeParse(item)
    return parsed.success ? [parsed.data as T] : []
  })
}

// /admin/projects/[id] — one project's public page (/projects/[slug]),
// editable: header, links, sections, live data and document. See
// components/admin/project-page-editor.tsx.
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) notFound()

  let row: typeof projectEntries.$inferSelect | undefined
  try {
    ;[row] = await db.select().from(projectEntries).where(eq(projectEntries.id, numericId)).limit(1)
  } catch {
    return (
      <main className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
        <p className="text-sm text-muted-foreground">
          This project couldn&rsquo;t be loaded from the database. If you just updated the site, run{' '}
          <code>npm run db:push</code> and reload.
        </p>
        <Link href="/admin/projects" className="mt-4 inline-block text-sm font-medium text-steel-700 hover:text-navy">
          &larr; All projects
        </Link>
      </main>
    )
  }
  if (!row) notFound()

  const parsedOutput = parseProjectOutput(row.output)
  const languages = stackListSchema.safeParse(row.languages)
  const apis = stackListSchema.safeParse(row.apis)

  const data: ProjectPageEditorData = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    kind: row.kind,
    date: row.date.toISOString().slice(0, 10),
    summary: row.summary || row.excerpt,
    tags: parseTags(row.tags),
    published: row.published,
    projectType: row.projectType,
    mode: row.mode,
    languages: languages.success ? languages.data : [],
    apis: apis.success ? apis.data : [],
    featured: row.featured,
    links: validItems<ProjectLink>(row.links, projectLinkSchema),
    outputUrl: row.outputUrl ?? '',
    embedUrl: row.embedUrl ?? '',
    updateFrequency: row.updateFrequency,
    sections: validItems<ProjectSection>(row.sections, projectSectionSchema),
    contentType: row.contentType,
    pdfUrl: row.pdfUrl,
    pdfFilename: row.pdfFilename,
    latexSource: row.latexSource,
    output: parsedOutput.success ? parsedOutput.data : null,
    outputCheckedAt: row.outputCheckedAt?.toISOString() ?? null,
    outputError: row.outputError,
  }

  return (
    <ProjectPageEditor
      data={data}
      embedOrigins={parseEmbedOrigins(process.env.PROJECT_EMBED_ORIGINS)}
      refreshConfigured={Boolean(process.env.PROJECT_REFRESH_SECRET)}
    />
  )
}
