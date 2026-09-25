import { listAdminProjects } from '@/lib/queries'
import { getListPageContent } from '@/lib/site-content'
import { parseTags } from '@/lib/validations'
import { parseProjectOutput } from '@/lib/project-output'
import { outputHealth, summariseOutput } from '@/lib/project-meta'
import { ProjectsEditor, type ProjectsEditorData } from '@/components/admin/projects-editor'

export const metadata = { title: 'Edit Projects' }

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

// /admin/projects — the public /projects page, editable. See
// components/admin/projects-editor.tsx. Each project's own page is edited
// at /admin/projects/[id].
export default async function AdminProjectsPage() {
  const [rows, content] = await Promise.all([
    listAdminProjects().catch(() => null),
    getListPageContent('projects'),
  ])

  const data: ProjectsEditorData = {
    header: content.header,
    loadError: rows === null,
    rows: (rows ?? []).map((row) => {
      const parsed = parseProjectOutput(row.output)
      const output = parsed.success ? parsed.data : null
      return {
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
        languages: stringList(row.languages),
        apis: stringList(row.apis),
        featured: row.featured,
        updateFrequency: row.updateFrequency,
        output: summariseOutput(output),
        health: outputHealth({
          outputUrl: row.outputUrl,
          output,
          outputError: row.outputError,
          updateFrequency: row.updateFrequency,
        }),
        outputError: row.outputError,
      }
    }),
  }

  return <ProjectsEditor data={data} />
}
