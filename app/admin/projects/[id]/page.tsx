import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectEntries } from '@/lib/db/schema'
import { EntryForm } from '@/components/entry-form'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(projectEntries)
    .where(eq(projectEntries.id, Number(id)))
    .limit(1)

  if (!row) notFound()

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-navy">Edit project</h1>
      <div className="mt-6">
        <EntryForm
          kind="project"
          entryId={row.id}
          defaults={{
            title: row.title,
            slug: row.slug,
            category: row.category,
            tags: row.tags,
            date: row.date.toISOString().slice(0, 10),
            excerpt: row.excerpt || row.summary,
            contentType: row.contentType,
            status: row.status,
            kind: row.kind,
            latexSource: row.latexSource,
            sortOrder: row.sortOrder,
            published: row.published,
          }}
        />
      </div>
    </main>
  )
}
