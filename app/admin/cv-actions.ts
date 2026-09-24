"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  experienceEntries,
  educationEntries,
  languageEntries,
  cvProfile,
} from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { savePdfBlob } from "@/lib/blobs"
import {
  MAX_PDF_BYTES,
  experienceInputSchema,
  educationInputSchema,
  languageInputSchema,
  cvProfileInputSchema,
} from "@/lib/validations"
import { errorMessage } from "@/lib/action-error"

const CV_PROFILE_ID = 1

// All CV admin actions redirect back to /admin on both success and failure.
// On failure they attach ?error=... instead of throwing, for the same
// reason as app/admin/actions.ts: an uncaught throw from a Server Action
// gets redacted to a generic message in production, which would hide real
// validation/DB errors from the only person who ever sees this page.
function errorRedirect(error: unknown): never {
  redirect(`/admin?error=${encodeURIComponent(errorMessage(error))}`)
}

// ---- Experience ------------------------------------------------------

function experienceFieldsFrom(formData: FormData) {
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

  try {
    const fields = experienceFieldsFrom(formData)
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
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

export async function updateExperienceAction(id: number, formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = experienceFieldsFrom(formData)
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
  } catch (error) {
    errorRedirect(error)
  }

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

// ---- Education ---------------------------------------------------------

function educationFieldsFrom(formData: FormData) {
  return educationInputSchema.parse({
    school: formData.get("school"),
    location: formData.get("location") ?? "",
    degree: formData.get("degree"),
    period: formData.get("period"),
    details: formData.get("details"),
    sortOrder: formData.get("sortOrder") ?? 0,
    published: formData.get("published") === "on",
  })
}

export async function createEducationAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = educationFieldsFrom(formData)
    await db.insert(educationEntries).values({
      userId: session.user.id,
      school: fields.school,
      location: fields.location ?? "",
      degree: fields.degree,
      period: fields.period,
      details: fields.details,
      sortOrder: fields.sortOrder,
      published: fields.published ?? true,
    })
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

export async function updateEducationAction(id: number, formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = educationFieldsFrom(formData)
    await db
      .update(educationEntries)
      .set({
        school: fields.school,
        location: fields.location ?? "",
        degree: fields.degree,
        period: fields.period,
        details: fields.details,
        sortOrder: fields.sortOrder,
        published: fields.published ?? true,
        updatedAt: new Date(),
      })
      .where(eq(educationEntries.id, id))
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

export async function deleteEducationAction(id: number) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  await db.delete(educationEntries).where(eq(educationEntries.id, id))
  revalidatePath("/cv")
  redirect("/admin")
}

// ---- Languages -----------------------------------------------------------

function languageFieldsFrom(formData: FormData) {
  return languageInputSchema.parse({
    name: formData.get("name"),
    level: formData.get("level"),
    sortOrder: formData.get("sortOrder") ?? 0,
    published: formData.get("published") === "on",
  })
}

export async function createLanguageAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = languageFieldsFrom(formData)
    await db.insert(languageEntries).values({
      userId: session.user.id,
      name: fields.name,
      level: fields.level,
      sortOrder: fields.sortOrder,
      published: fields.published ?? true,
    })
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

export async function updateLanguageAction(id: number, formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = languageFieldsFrom(formData)
    await db
      .update(languageEntries)
      .set({
        name: fields.name,
        level: fields.level,
        sortOrder: fields.sortOrder,
        published: fields.published ?? true,
        updatedAt: new Date(),
      })
      .where(eq(languageEntries.id, id))
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

export async function deleteLanguageAction(id: number) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  await db.delete(languageEntries).where(eq(languageEntries.id, id))
  revalidatePath("/cv")
  redirect("/admin")
}

// ---- Profile & skills (singleton row) -------------------------------

export async function updateCvProfileAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const [existing] = await db
      .select()
      .from(cvProfile)
      .where(eq(cvProfile.id, CV_PROFILE_ID))
      .limit(1)

    // A field missing from this particular submission (because it's a
    // different section of the split profile form, not present in this
    // <form> at all) keeps its current DB value rather than being wiped to
    // "" — that's what makes it safe to save one section at a time.
    function field(name: string): string {
      const value = formData.get(name)
      if (value === null) return (existing?.[name as keyof typeof existing] as string) ?? ''
      return String(value)
    }

    const fields = cvProfileInputSchema.parse({
      tagline: field('tagline'),
      nationality: field('nationality'),
      location: field('location'),
      email: field('email'),
      phone: field('phone'),
      linkedin: field('linkedin'),
      linkedinUrl: field('linkedinUrl'),
      programmingSkills: field('programmingSkills'),
      methodSkills: field('methodSkills'),
    })

    // Upsert: this table only ever has one row (id = 1). Insert it the
    // first time this is saved, update it every time after.
    await db
      .insert(cvProfile)
      .values({
        id: CV_PROFILE_ID,
        tagline: fields.tagline,
        nationality: fields.nationality ?? "",
        location: fields.location ?? "",
        email: fields.email ?? "",
        phone: fields.phone ?? "",
        linkedin: fields.linkedin ?? "",
        linkedinUrl: fields.linkedinUrl ?? "",
        programmingSkills: fields.programmingSkills,
        methodSkills: fields.methodSkills,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cvProfile.id,
        set: {
          tagline: fields.tagline,
          nationality: fields.nationality ?? "",
          location: fields.location ?? "",
          email: fields.email ?? "",
          phone: fields.phone ?? "",
          linkedin: fields.linkedin ?? "",
          linkedinUrl: fields.linkedinUrl ?? "",
          programmingSkills: fields.programmingSkills,
          methodSkills: fields.methodSkills,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}

// ---- CV document (PDF) -------------------------------------------------

async function resolveCvPdf(formData: FormData) {
  // Direct-to-bucket upload: the browser already PUT the file straight to
  // the S3-compatible bucket via a presigned URL (see requestPdfUploadUrl
  // in app/admin/actions.ts, reused here) before this action ran — same
  // pattern as paper/project PDFs (see resolvePdf in app/admin/actions.ts).
  const pdfKey = formData.get("pdfKey")
  if (typeof pdfKey === "string" && pdfKey) {
    const pdfFilename = formData.get("pdfFilename")
    return {
      key: pdfKey,
      filename: typeof pdfFilename === "string" && pdfFilename ? pdfFilename : "CV.pdf",
    }
  }

  // Fallback — used only when no bucket is configured yet (S3_BUCKET/etc.
  // unset), so the file is uploaded the original way, through this action.
  const file = formData.get("pdf")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("A PDF file is required")
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are accepted")
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF files must be 8MB or smaller")
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const stored = await savePdfBlob(file.name, buffer)
  return { key: stored.key, filename: file.name }
}

export async function updateCvPdfAction(formData: FormData) {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const pdf = await resolveCvPdf(formData)

    // Same singleton-row upsert as updateCvProfileAction above — only the
    // two PDF columns are touched, so replacing the CV never affects the
    // description/contact/skills sections saved separately.
    await db
      .insert(cvProfile)
      .values({
        id: CV_PROFILE_ID,
        cvPdfPathname: pdf.key,
        cvPdfFilename: pdf.filename,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cvProfile.id,
        set: {
          cvPdfPathname: pdf.key,
          cvPdfFilename: pdf.filename,
          updatedAt: new Date(),
        },
      })
  } catch (error) {
    errorRedirect(error)
  }

  revalidatePath("/cv")
  redirect("/admin")
}
