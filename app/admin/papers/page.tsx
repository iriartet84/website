import { listAdminPapers, paperCategories } from '@/lib/queries'
import { getListPageContent } from '@/lib/site-content'
import { staticPublicPapers } from '@/lib/public-content'
import { parseTags } from '@/lib/validations'
import { PapersEditor, type PapersEditorData } from '@/components/admin/papers-editor'

export const metadata = { title: 'Edit Papers & Briefs' }

// /admin/papers — the public /papers page, editable. See
// components/admin/papers-editor.tsx.
export default async function AdminPapersPage() {
  const [rows, content] = await Promise.all([
    listAdminPapers().catch(() => null),
    getListPageContent('papers'),
  ])

  const data: PapersEditorData = {
    header: content.header,
    categories: [...paperCategories],
    loadError: rows === null,
    rows: (rows ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      type: row.type,
      date: row.date.toISOString().slice(0, 10),
      excerpt: row.excerpt || row.abstract,
      tags: parseTags(row.tags || row.methods),
      published: row.published,
      contentType: row.contentType,
      pdfUrl: row.pdfUrl,
      pdfFilename: row.pdfFilename,
      latexSource: row.latexSource,
    })),
    // What visitors see while no paper is published (lib/queries.ts falls
    // back to these) — offered as the starting point when the table is empty.
    defaults: staticPublicPapers().map((paper) => ({
      slug: paper.slug,
      title: paper.title,
      category: paper.category,
      type: paper.type,
      date: paper.date,
      excerpt: paper.excerpt,
      tags: paper.tags,
    })),
  }

  return <PapersEditor data={data} />
}
