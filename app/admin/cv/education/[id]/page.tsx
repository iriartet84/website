import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { educationEntries } from '@/lib/db/schema'
import { EducationForm } from '@/components/education-form'

export default async function EditEducationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(educationEntries)
    .where(eq(educationEntries.id, Number(id)))
    .limit(1)

  if (!row) notFound()

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-navy">Edit education</h1>
      <div className="mt-6">
        <EducationForm
          entryId={row.id}
          defaults={{
            school: row.school,
            location: row.location,
            degree: row.degree,
            period: row.period,
            details: row.details,
            sortOrder: row.sortOrder,
            published: row.published,
          }}
        />
      </div>
    </main>
  )
}
