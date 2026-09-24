import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { paperEntries } from '@/lib/db/schema'
import { EntryForm } from '@/components/entry-form'

export default async function EditPaperPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(paperEntries)
    .where(eq(paperEntries.id, Number(id)))
    .limit(1)

  if (!row) notFound()

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-navy">Edit paper</h1>
      <div className="mt-6">
        <EntryForm
          kind="paper"
          entryId={row.id}
          defaults={{
            title: row.title,
            slug: row.slug,
            category: row.category,
            tags: row.tags || row.methods,
            date: row.date.toISOString().slice(0, 10),
            excerpt: row.excerpt || row.abstract,
            contentType: row.contentType,
            type: row.type,
            latexSource: row.latexSource,
            sortOrder: row.sortOrder,
            published: row.published,
          }}
        />
      </div>
    </main>
  )
}
