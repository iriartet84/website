import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { languageEntries } from '@/lib/db/schema'
import { LanguageForm } from '@/components/language-form'

export default async function EditLanguagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(languageEntries)
    .where(eq(languageEntries.id, Number(id)))
    .limit(1)

  if (!row) notFound()

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-navy">Edit language</h1>
      <div className="mt-6">
        <LanguageForm
          entryId={row.id}
          defaults={{
            name: row.name,
            level: row.level,
            sortOrder: row.sortOrder,
            published: row.published,
          }}
        />
      </div>
    </main>
  )
}
