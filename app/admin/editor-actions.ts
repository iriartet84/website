"use server"

import { revalidatePath } from "next/cache"
import { eq, inArray } from "drizzle-orm"
import type { ZodError } from "zod"
import { db } from "@/lib/db"
import {
  cvProfile,
  educationEntries,
  experienceEntries,
  languageEntries,
  paperEntries,
  projectEntries,
  siteContent,
} from "@/lib/db/schema"
import { requireAdmin } from "@/lib/require-admin"
import { contentTypeForKey, isStorageKey, savePdfBlob, statStoredFile } from "@/lib/blobs"
import { compileLatex } from "@/lib/compile-latex"
import { errorMessage } from "@/lib/action-error"
import {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  cvPagePayloadSchema,
  papersPagePayloadSchema,
  projectsPagePayloadSchema,
  type DocumentChange,
} from "@/lib/validations"
import {
  homeContentSchema,
  pageHeaderSchema,
  type HomeContent,
  type ListPageKey,
  type PageHeaderContent,
} from "@/lib/site-content-shared"
import { getHomeContent } from "@/lib/site-content"

// Save actions for the page editors under /admin (components/admin/*).
// Each one saves a whole page in a single call — the editors keep every
// change local (that's what makes the live preview possible) until the
// explicit Save — and returns a result instead of redirecting, so the
// editor can show feedback in place and stay on the page.
//
// These are separate from app/admin/actions.ts and cv-actions.ts, which are
// left as they were: they're still used by the /api/admin/entries route and
// they end in redirect("/admin"), which suits a form post but not an
// in-page editor.

export type SaveResult =
  | { ok: true }
  // clientKey identifies the item the error belongs to, so the editor can
  // scroll to it and highlight it.
  | { ok: false; error: string; clientKey?: string }

const CV_PROFILE_ID = 1
const SIGNED_OUT: SaveResult = {
  ok: false,
  error: "Your session has ended. Sign in again in another tab, then save — your edits are still here.",
}

// ---- Helpers ---------------------------------------------------------------

type Labelled = { clientKey: string; label: string }

// Turns the first validation issue into a message that says *which* item
// is wrong, e.g. "“Oil supply shocks”: Description needs at least 20
// characters". `lists` maps a top-level payload key to its items' labels.
function describeIssue(
  error: ZodError,
  lists: Record<string, Labelled[]>,
  fallbackLabel?: string,
): SaveResult {
  const issue = error.issues[0]
  if (!issue) return { ok: false, error: "Some fields are invalid." }
  const path = issue.path
  // Paths look like ["items", 3, "excerpt"] or ["experience", "items", 1, "role"].
  for (let i = 0; i < path.length - 1; i++) {
    const listKey = path.slice(0, i + 1).join(".")
    const index = path[i + 1]
    const list = lists[listKey]
    if (list && typeof index === "number" && list[index]) {
      const item = list[index]
      return { ok: false, error: `${item.label}: ${issue.message}`, clientKey: item.clientKey }
    }
  }
  return { ok: false, error: fallbackLabel ? `${fallbackLabel}: ${issue.message}` : issue.message }
}

function quoted(text: string, fallback: string) {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  return `“${trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed}”`
}

// A save failing because the database schema is behind the code (e.g. the
// site_content table not created yet) gets a message saying what to do.
function saveFailed(error: unknown): SaveResult {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const pg = candidate as { code?: string } | undefined
    if (pg?.code === "42P01" || pg?.code === "42703") {
      return {
        ok: false,
        error: "The database is missing a table or column this editor needs. Run `npm run db:push`, then save again.",
      }
    }
  }
  return { ok: false, error: `Couldn't save: ${errorMessage(error)}` }
}

function uniqueViolation(error: unknown): string | null {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const pg = candidate as { code?: string; detail?: string } | undefined
    if (pg?.code === "23505") {
      const match = pg.detail?.match(/\(slug\)=\((.*)\)/)
      return match ? match[1] : ""
    }
  }
  return null
}

// Confirms an uploaded file really landed in storage (a presigned PUT can
// fail or be abandoned) and is within the size limit — presigned uploads
// can't enforce a maximum size by themselves.
async function checkUpload(
  key: string,
  expected: "pdf" | "image",
  label: string,
): Promise<string | null> {
  if (!isStorageKey(key)) return `${label}: the uploaded file reference is invalid.`
  const isPdf = contentTypeForKey(key) === "application/pdf"
  if (expected === "pdf" ? !isPdf : isPdf) return `${label}: the uploaded file has the wrong type.`
  const stat = await statStoredFile(key)
  if (!stat.found) return `${label}: the upload didn't finish. Choose the file again and save.`
  const max = expected === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
  if (stat.size !== null && stat.size > max) {
    return `${label}: the file is larger than ${Math.round(max / (1024 * 1024))}MB.`
  }
  return null
}

type ResolvedDocument =
  | { change: false }
  | {
      change: true
      contentType: "pdf" | "latex"
      pdfUrl: string
      pdfPathname: string
      pdfFilename: string
      latexSource: string | null
    }

async function resolveDocument(
  document: DocumentChange,
  label: string,
): Promise<ResolvedDocument | { error: string }> {
  if (document.kind === "keep") return { change: false }

  if (document.kind === "upload") {
    const problem = await checkUpload(document.key, "pdf", label)
    if (problem) return { error: problem }
    return {
      change: true,
      contentType: "pdf",
      pdfUrl: `/api/files/${encodeURIComponent(document.key)}`,
      pdfPathname: document.key,
      pdfFilename: document.filename,
      latexSource: null,
    }
  }

  try {
    const pdf = await compileLatex(document.source)
    const stored = await savePdfBlob("compiled.pdf", pdf)
    return {
      change: true,
      contentType: "latex",
      pdfUrl: stored.url,
      pdfPathname: stored.key,
      pdfFilename: "compiled.pdf",
      latexSource: document.source,
    }
  } catch (error) {
    return { error: `${label}: LaTeX compilation failed — ${errorMessage(error)}` }
  }
}

async function upsertSiteContent(key: string, value: unknown) {
  await db
    .insert(siteContent)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteContent.key, set: { value, updatedAt: new Date() } })
}

// ---- Home -----------------------------------------------------------------

export async function saveHomeContentAction(content: HomeContent): Promise<SaveResult> {
  const session = await requireAdmin()
  if (!session) return SIGNED_OUT

  const parsed = homeContentSchema.safeParse(content)
  if (!parsed.success) {
    const cards = (content?.research?.sections ?? []).map((section, i) => ({
      clientKey: section?.id ?? String(i),
      label: `Research card ${quoted(section?.title ?? "", String(i + 1))}`,
    }))
    const skills = (content?.skills?.items ?? []).map((skill, i) => ({
      clientKey: skill?.id ?? String(i),
      label: `Skill ${quoted(skill?.title ?? "", String(i + 1))}`,
    }))
    return describeIssue(parsed.error, { "research.sections": cards, "skills.items": skills })
  }

  // Newly uploaded images must exist in storage; images already saved
  // before are left alone (no need to re-check them on every save).
  const current = await getHomeContent()
  const previousImages = new Set(current.research.sections.map((s) => s.image))
  for (const section of parsed.data.research.sections) {
    if (section.image.startsWith("/api/files/") && !previousImages.has(section.image)) {
      const key = decodeURIComponent(section.image.slice("/api/files/".length))
      const problem = await checkUpload(key, "image", `Research card ${quoted(section.title, "")}`)
      if (problem) return { ok: false, error: problem, clientKey: section.id }
    }
  }

  try {
    await upsertSiteContent("home", parsed.data)
  } catch (error) {
    return saveFailed(error)
  }

  revalidatePath("/")
  return { ok: true }
}

// ---- Papers & projects ------------------------------------------------------

function checkHeader(header: PageHeaderContent): SaveResult | null {
  const parsed = pageHeaderSchema.safeParse(header)
  if (parsed.success) return null
  return describeIssue(parsed.error, {}, "Page header")
}

function duplicateSlug(items: { slug: string; clientKey: string; title: string }[]) {
  const seen = new Map<string, string>()
  for (const item of items) {
    const other = seen.get(item.slug)
    if (other !== undefined) {
      return {
        ok: false as const,
        error: `${quoted(item.title, "An entry")} has the same slug as ${other} — slugs must be unique.`,
        clientKey: item.clientKey,
      }
    }
    seen.set(item.slug, quoted(item.title, "another entry"))
  }
  return null
}

function revalidateLists() {
  revalidatePath("/papers")
  revalidatePath("/papers/[slug]", "page")
  revalidatePath("/projects")
  revalidatePath("/projects/[slug]", "page")
  revalidatePath("/")
  revalidatePath("/sitemap.xml")
}

type ListInput<T> = { header: PageHeaderContent; items: T[]; deletedIds: number[] }

export async function savePapersPageAction(
  input: ListInput<unknown>,
): Promise<SaveResult> {
  const session = await requireAdmin()
  if (!session) return SIGNED_OUT

  const headerProblem = checkHeader(input?.header)
  if (headerProblem) return headerProblem

  const rawItems = Array.isArray(input?.items) ? input.items : []
  const labels = rawItems.map((item, i) => {
    const it = item as { clientKey?: string; title?: string }
    return { clientKey: it?.clientKey ?? String(i), label: quoted(it?.title ?? "", `Paper ${i + 1}`) }
  })
  const parsed = papersPagePayloadSchema.safeParse({ items: rawItems, deletedIds: input?.deletedIds })
  if (!parsed.success) return describeIssue(parsed.error, { items: labels })
  const { items, deletedIds } = parsed.data

  const dup = duplicateSlug(items)
  if (dup) return dup

  // Resolve uploads/LaTeX before opening the transaction — compiling can
  // take a while and doesn't need to hold a database connection.
  const documents: ResolvedDocument[] = []
  for (const item of items) {
    const resolved = await resolveDocument(item.document, quoted(item.title, "A paper"))
    if ("error" in resolved) return { ok: false, error: resolved.error, clientKey: item.clientKey }
    documents.push(resolved)
  }

  const keptIds = new Set(items.map((item) => item.id).filter((id): id is number => id !== null))
  const toDelete = deletedIds.filter((id) => !keptIds.has(id))

  try {
    await db.transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.delete(paperEntries).where(inArray(paperEntries.id, toDelete))
      }
      for (const [index, item] of items.entries()) {
        const date = new Date(`${item.date}T00:00:00Z`)
        const doc = documents[index]
        const tags = item.tags.join(", ")
        const fields = {
          title: item.title,
          slug: item.slug,
          category: item.category,
          year: String(date.getUTCFullYear()),
          date,
          type: item.type,
          excerpt: item.excerpt,
          abstract: item.excerpt,
          tags,
          methods: tags,
          published: item.published,
          sortOrder: index,
          ...(doc.change
            ? {
                contentType: doc.contentType,
                pdfUrl: doc.pdfUrl,
                pdfPathname: doc.pdfPathname,
                pdfFilename: doc.pdfFilename,
                latexSource: doc.latexSource,
              }
            : {}),
        }
        if (item.id !== null) {
          await tx
            .update(paperEntries)
            .set({ ...fields, updatedAt: new Date() })
            .where(eq(paperEntries.id, item.id))
        } else {
          await tx.insert(paperEntries).values({ ...fields, userId: session.user.id })
        }
      }
      await tx
        .insert(siteContent)
        .values({ key: "papers" satisfies ListPageKey, value: { header: input.header }, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteContent.key,
          set: { value: { header: input.header }, updatedAt: new Date() },
        })
    })
  } catch (error) {
    const slug = uniqueViolation(error)
    if (slug !== null) {
      const item = items.find((it) => it.slug === slug)
      return {
        ok: false,
        error: `The slug “${slug}” is already used by another paper.`,
        clientKey: item?.clientKey,
      }
    }
    return saveFailed(error)
  }

  revalidateLists()
  return { ok: true }
}

export async function saveProjectsPageAction(
  input: ListInput<unknown>,
): Promise<SaveResult> {
  const session = await requireAdmin()
  if (!session) return SIGNED_OUT

  const headerProblem = checkHeader(input?.header)
  if (headerProblem) return headerProblem

  const rawItems = Array.isArray(input?.items) ? input.items : []
  const labels = rawItems.map((item, i) => {
    const it = item as { clientKey?: string; title?: string }
    return { clientKey: it?.clientKey ?? String(i), label: quoted(it?.title ?? "", `Project ${i + 1}`) }
  })
  const parsed = projectsPagePayloadSchema.safeParse({ items: rawItems, deletedIds: input?.deletedIds })
  if (!parsed.success) return describeIssue(parsed.error, { items: labels })
  const { items, deletedIds } = parsed.data

  const dup = duplicateSlug(items)
  if (dup) return dup

  const documents: ResolvedDocument[] = []
  for (const item of items) {
    const resolved = await resolveDocument(item.document, quoted(item.title, "A project"))
    if ("error" in resolved) return { ok: false, error: resolved.error, clientKey: item.clientKey }
    documents.push(resolved)
  }

  const keptIds = new Set(items.map((item) => item.id).filter((id): id is number => id !== null))
  const toDelete = deletedIds.filter((id) => !keptIds.has(id))

  try {
    await db.transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.delete(projectEntries).where(inArray(projectEntries.id, toDelete))
      }
      for (const [index, item] of items.entries()) {
        const doc = documents[index]
        const fields = {
          title: item.title,
          slug: item.slug,
          category: item.category,
          date: new Date(`${item.date}T00:00:00Z`),
          summary: item.summary,
          excerpt: item.summary,
          tags: item.tags.join(", "),
          status: item.status,
          kind: item.kind,
          published: item.published,
          sortOrder: index,
          ...(doc.change
            ? {
                contentType: doc.contentType,
                pdfUrl: doc.pdfUrl,
                pdfPathname: doc.pdfPathname,
                pdfFilename: doc.pdfFilename,
                latexSource: doc.latexSource,
              }
            : {}),
        }
        if (item.id !== null) {
          await tx
            .update(projectEntries)
            .set({ ...fields, updatedAt: new Date() })
            .where(eq(projectEntries.id, item.id))
        } else {
          await tx.insert(projectEntries).values({ ...fields, userId: session.user.id })
        }
      }
      await tx
        .insert(siteContent)
        .values({ key: "projects" satisfies ListPageKey, value: { header: input.header }, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteContent.key,
          set: { value: { header: input.header }, updatedAt: new Date() },
        })
    })
  } catch (error) {
    const slug = uniqueViolation(error)
    if (slug !== null) {
      const item = items.find((it) => it.slug === slug)
      return {
        ok: false,
        error: `The slug “${slug}” is already used by another project.`,
        clientKey: item?.clientKey,
      }
    }
    return saveFailed(error)
  }

  revalidateLists()
  return { ok: true }
}

// ---- CV ---------------------------------------------------------------------

export async function saveCvPageAction(input: unknown): Promise<SaveResult> {
  const session = await requireAdmin()
  if (!session) return SIGNED_OUT

  const raw = (input ?? {}) as Record<string, { items?: unknown[] } | undefined>
  const label = (prefix: string, field: string) => (item: unknown, i: number) => {
    const it = item as Record<string, unknown> | null
    return {
      clientKey: String(it?.clientKey ?? i),
      label: `${prefix} ${quoted(String(it?.[field] ?? ""), String(i + 1))}`,
    }
  }
  const parsed = cvPagePayloadSchema.safeParse(input)
  if (!parsed.success) {
    return describeIssue(
      parsed.error,
      {
        "experience.items": (raw.experience?.items ?? []).map(label("Experience", "org")),
        "education.items": (raw.education?.items ?? []).map(label("Education", "school")),
        "languages.items": (raw.languages?.items ?? []).map(label("Language", "name")),
      },
      "CV details",
    )
  }
  const { profile, cvPdf, experience, education, languages } = parsed.data

  if (cvPdf.kind === "upload") {
    const problem = await checkUpload(cvPdf.key, "pdf", "CV PDF")
    if (problem) return { ok: false, error: problem, clientKey: "cv-pdf" }
  }
  const pdfFields =
    cvPdf.kind === "upload"
      ? { cvPdfPathname: cvPdf.key, cvPdfFilename: cvPdf.filename }
      : cvPdf.kind === "remove"
        ? { cvPdfPathname: null, cvPdfFilename: null }
        : {}

  const profileFields = {
    tagline: profile.tagline,
    nationality: profile.nationality,
    location: profile.location,
    email: profile.email,
    phone: profile.phone,
    linkedin: profile.linkedin,
    linkedinUrl: profile.linkedinUrl,
    programmingSkills: profile.programming.join("\n"),
    methodSkills: profile.methods.join("\n"),
    ...pdfFields,
    updatedAt: new Date(),
  }

  const without = (deleted: number[], items: { id: number | null }[]) => {
    const kept = new Set(items.map((item) => item.id))
    return deleted.filter((id) => !kept.has(id))
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(cvProfile)
        .values({ id: CV_PROFILE_ID, ...profileFields })
        .onConflictDoUpdate({ target: cvProfile.id, set: profileFields })

      const expDelete = without(experience.deletedIds, experience.items)
      if (expDelete.length) await tx.delete(experienceEntries).where(inArray(experienceEntries.id, expDelete))
      for (const [index, item] of experience.items.entries()) {
        const fields = {
          org: item.org,
          role: item.role,
          location: item.location,
          period: item.period,
          summary: item.summary,
          details: item.details.join("\n"),
          published: item.published,
          sortOrder: index,
        }
        if (item.id !== null) {
          await tx.update(experienceEntries).set({ ...fields, updatedAt: new Date() }).where(eq(experienceEntries.id, item.id))
        } else {
          await tx.insert(experienceEntries).values({ ...fields, userId: session.user.id })
        }
      }

      const eduDelete = without(education.deletedIds, education.items)
      if (eduDelete.length) await tx.delete(educationEntries).where(inArray(educationEntries.id, eduDelete))
      for (const [index, item] of education.items.entries()) {
        const fields = {
          school: item.school,
          location: item.location,
          degree: item.degree,
          period: item.period,
          details: item.details.join("\n"),
          published: item.published,
          sortOrder: index,
        }
        if (item.id !== null) {
          await tx.update(educationEntries).set({ ...fields, updatedAt: new Date() }).where(eq(educationEntries.id, item.id))
        } else {
          await tx.insert(educationEntries).values({ ...fields, userId: session.user.id })
        }
      }

      const langDelete = without(languages.deletedIds, languages.items)
      if (langDelete.length) await tx.delete(languageEntries).where(inArray(languageEntries.id, langDelete))
      for (const [index, item] of languages.items.entries()) {
        const fields = { name: item.name, level: item.level, published: item.published, sortOrder: index }
        if (item.id !== null) {
          await tx.update(languageEntries).set({ ...fields, updatedAt: new Date() }).where(eq(languageEntries.id, item.id))
        } else {
          await tx.insert(languageEntries).values({ ...fields, userId: session.user.id })
        }
      }
    })
  } catch (error) {
    return saveFailed(error)
  }

  revalidatePath("/cv")
  return { ok: true }
}
