"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { ZodError } from "zod"
import { db } from "@/lib/db"
import { paperEntries, projectEntries } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { savePdfBlob } from "@/lib/blobs"
import { compileLatex } from "@/lib/compile-latex"
import {
  MAX_PDF_BYTES,
  entryInputSchema,
  parseTags,
} from "@/lib/validations"

// Shape returned to the client on failure. Server Actions used with
// useActionState/useFormState should return this instead of throwing for
// anything the user can actually act on (bad LaTeX, missing file, a
// validation issue) — Next.js redacts uncaught Server Action errors down to
// a generic message + digest in production builds, so throwing here would
// silently swallow the compiler's actual error text.
export type ActionState = { error?: string }

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.errors.map((e) => e.message).join(", ")
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Something went wrong. Please try again."
}

async function resolvePdf(formData: FormData) {
  const contentType = String(formData.get("contentType") ?? "pdf")
  if (contentType === "latex") {
    const latexSource = String(formData.get("latexSource") ?? "")
    if (!latexSource.trim()) {
      throw new Error("LaTeX source is required")
    }
    const pdf = await compileLatex(latexSource)
    const stored = await savePdfBlob("compiled.pdf", pdf)
    return { ...stored, latexSource, filename: "compiled.pdf" }
  }

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
  return { ...stored, latexSource: null, filename: file.name }
}

function fieldsFrom(formData: FormData) {
  const parsed = entryInputSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    category: formData.get("category"),
    tags: formData.get("tags") ?? "",
    date: formData.get("date"),
    excerpt: formData.get("excerpt"),
    contentType: formData.get("contentType"),
    type: formData.get("type") ?? undefined,
    status: formData.get("status") ?? undefined,
    kind: formData.get("kind") ?? undefined,
    latexSource: formData.get("latexSource") ?? undefined,
    published: formData.get("published") === "on",
  })
  const date = new Date(parsed.date)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date is invalid")
  }
  return {
    ...parsed,
    date,
    year: String(date.getFullYear()),
    tags: parseTags(parsed.tags).join(", "),
  }
}

function revalidatePublic() {
  revalidatePath("/papers")
  revalidatePath("/projects")
  revalidatePath("/")
  revalidatePath("/sitemap.xml")
}

export async function createPaperAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = fieldsFrom(formData)
    const pdf = await resolvePdf(formData)

    await db.insert(paperEntries).values({
      userId: session.user.id,
      title: fields.title,
      slug: fields.slug,
      category: fields.category,
      year: fields.year,
      date: fields.date,
      type: fields.type ?? "Paper",
      excerpt: fields.excerpt,
      abstract: fields.excerpt,
      tags: fields.tags,
      methods: fields.tags,
      contentType: fields.contentType,
      pdfUrl: pdf.url,
      pdfPathname: pdf.key,
      pdfFilename: pdf.filename,
      latexSource: pdf.latexSource,
      published: fields.published ?? true,
    })

    revalidatePublic()
  } catch (error) {
    return { error: errorMessage(error) }
  }

  // Outside the try/catch deliberately: redirect() works by throwing a
  // special NEXT_REDIRECT signal internally, which a catch block above
  // would otherwise intercept and treat as a normal error.
  redirect("/admin")
}

export async function updatePaperAction(
  id: number,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = fieldsFrom(formData)
    const file = formData.get("pdf")
    const hasFile = file instanceof File && file.size > 0
    const latexChanged =
      fields.contentType === "latex" && String(formData.get("latexSource") ?? "").trim()

    const patch: Record<string, unknown> = {
      title: fields.title,
      slug: fields.slug,
      category: fields.category,
      year: fields.year,
      date: fields.date,
      type: fields.type ?? "Paper",
      excerpt: fields.excerpt,
      abstract: fields.excerpt,
      tags: fields.tags,
      methods: fields.tags,
      contentType: fields.contentType,
      published: fields.published ?? true,
      updatedAt: new Date(),
    }

    if (hasFile || (fields.contentType === "latex" && latexChanged)) {
      const pdf = await resolvePdf(formData)
      patch.pdfUrl = pdf.url
      patch.pdfPathname = pdf.key
      patch.pdfFilename = pdf.filename
      patch.latexSource = pdf.latexSource
    }

    await db.update(paperEntries).set(patch).where(eq(paperEntries.id, id))
    revalidatePublic()
  } catch (error) {
    return { error: errorMessage(error) }
  }

  redirect("/admin")
}

export async function deletePaperAction(id: number) {
  const session = await requireAdmin()
  if (!session) redirect("/login")
  await db.delete(paperEntries).where(eq(paperEntries.id, id))
  revalidatePublic()
  redirect("/admin")
}

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = fieldsFrom(formData)
    const pdf = await resolvePdf(formData)

    await db.insert(projectEntries).values({
      userId: session.user.id,
      title: fields.title,
      slug: fields.slug,
      category: fields.category,
      date: fields.date,
      summary: fields.excerpt,
      excerpt: fields.excerpt,
      tags: fields.tags,
      status: fields.status ?? "In progress",
      kind: fields.kind ?? "dashboard",
      contentType: fields.contentType,
      pdfUrl: pdf.url,
      pdfPathname: pdf.key,
      pdfFilename: pdf.filename,
      latexSource: pdf.latexSource,
      published: fields.published ?? true,
    })

    revalidatePublic()
  } catch (error) {
    return { error: errorMessage(error) }
  }

  redirect("/admin")
}

export async function updateProjectAction(
  id: number,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin()
  if (!session) redirect("/login")

  try {
    const fields = fieldsFrom(formData)
    const file = formData.get("pdf")
    const hasFile = file instanceof File && file.size > 0
    const latexChanged =
      fields.contentType === "latex" && String(formData.get("latexSource") ?? "").trim()

    const patch: Record<string, unknown> = {
      title: fields.title,
      slug: fields.slug,
      category: fields.category,
      date: fields.date,
      summary: fields.excerpt,
      excerpt: fields.excerpt,
      tags: fields.tags,
      status: fields.status ?? "In progress",
      kind: fields.kind ?? "dashboard",
      contentType: fields.contentType,
      published: fields.published ?? true,
      updatedAt: new Date(),
    }

    if (hasFile || (fields.contentType === "latex" && latexChanged)) {
      const pdf = await resolvePdf(formData)
      patch.pdfUrl = pdf.url
      patch.pdfPathname = pdf.key
      patch.pdfFilename = pdf.filename
      patch.latexSource = pdf.latexSource
    }

    await db.update(projectEntries).set(patch).where(eq(projectEntries.id, id))
    revalidatePublic()
  } catch (error) {
    return { error: errorMessage(error) }
  }

  redirect("/admin")
}

export async function deleteProjectAction(id: number) {
  const session = await requireAdmin()
  if (!session) redirect("/login")
  await db.delete(projectEntries).where(eq(projectEntries.id, id))
  revalidatePublic()
  redirect("/admin")
}
