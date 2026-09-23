"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { experienceEntries } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { experienceInputSchema } from "@/lib/validations"

function fieldsFrom(formData: FormData) {
  return experienceInputSchema.parse({
    org: formData.get("org"),
    role: formData.get("role"),
    location: formData.get("location") ?? "",
    period: formData.get("period"),
    summary: formData.get("summary") ?? "",
    details: formData.get("details"),
    sortOrder: formData.get("sortOrder") ?? 0,
    published: formData.get("published") === "on",
  })
}

export async function createExperienceAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  const fields = fieldsFrom(formData)

  await db.insert(experienceEntries).values({
    userId: session.user.id,
    org: fields.org,
    role: fields.role,
    location: fields.location ?? "",
    period: fields.period,
    summary: fields.summary ?? "",
    details: fields.details,
    sortOrder: fields.sortOrder,
    published: fields.published ?? true,
  })

  revalidatePath("/cv")
  redirect("/admin")
}

export async function updateExperienceAction(id: number, formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  const fields = fieldsFrom(formData)

  await db
    .update(experienceEntries)
    .set({
      org: fields.org,
      role: fields.role,
      location: fields.location ?? "",
      period: fields.period,
      summary: fields.summary ?? "",
      details: fields.details,
      sortOrder: fields.sortOrder,
      published: fields.published ?? true,
      updatedAt: new Date(),
    })
    .where(eq(experienceEntries.id, id))

  revalidatePath("/cv")
  redirect("/admin")
}

export async function deleteExperienceAction(id: number) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  await db.delete(experienceEntries).where(eq(experienceEntries.id, id))
  revalidatePath("/cv")
  redirect("/admin")
}
