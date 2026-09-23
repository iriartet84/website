import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { experienceEntries } from '@/lib/db/schema'
import { ExperienceForm } from '@/components/experience-form'

export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(experienceEntries)
    .where(eq(experienceEntries.id, Number(id)))
    .limit(1)

  if (!row) notFound()

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl text-navy">Edit experience</h1>
      <div className="mt-6">
        <ExperienceForm
          entryId={row.id}
          defaults={{
            org: row.org,
            role: row.role,
            location: row.location,
            period: row.period,
            summary: row.summary,
            details: row.details,
            sortOrder: row.sortOrder,
            published: row.published,
          }}
        />
      </div>
    </main>
  )
}
