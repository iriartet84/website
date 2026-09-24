import { listAdminProjects } from '@/lib/queries'
import { getListPageContent } from '@/lib/site-content'
import { staticPublicProjects } from '@/lib/public-content'
import { parseTags } from '@/lib/validations'
import { ProjectsEditor, type ProjectsEditorData } from '@/components/admin/projects-editor'

export const metadata = { title: 'Edit Projects' }

// /admin/projects — the public /projects page, editable. See
// components/admin/projects-editor.tsx.
export default async function AdminProjectsPage() {
  const [rows, content] = await Promise.all([
    listAdminProjects().catch(() => null),
    getListPageContent('projects'),
  ])

  const data: ProjectsEditorData = {
    header: content.header,
    loadError: rows === null,
    rows: (rows ?? []).map((row) => ({
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
      contentType: row.contentType,
      pdfUrl: row.pdfUrl,
      pdfFilename: row.pdfFilename,
      latexSource: row.latexSource,
    })),
    defaults: staticPublicProjects().map((project) => ({
      slug: project.slug,
      title: project.title,
      category: project.category,
      status: project.status,
      kind: project.kind,
      date: project.date,
      summary: project.summary,
      tags: project.tags,
    })),
  }

  return <ProjectsEditor data={data} />
}
