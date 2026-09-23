import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { paperEntries, projectEntries, experienceEntries } from "@/lib/db/schema"
import {
  paperCategories,
  staticPublicPapers,
  staticPublicProjects,
  staticPublicPaperDetails,
  staticPublicProjectDetails,
  type PublicPaper,
  type PublicProject,
  type PublicPaperDetail,
  type PublicProjectDetail,
} from "@/lib/public-content"
import { experience as staticExperience } from "@/lib/content"
import { parseTags, parseDetails } from "@/lib/validations"

export type PublicExperience = {
  org: string
  role: string
  location: string
  period: string
  summary: string
  details: string[]
}

export async function getPublishedExperience(): Promise<PublicExperience[]> {
  if (!process.env.DATABASE_URL) {
    return staticExperience
  }

  try {
    const rows = await db
      .select()
      .from(experienceEntries)
      .where(eq(experienceEntries.published, true))
      .orderBy(experienceEntries.sortOrder)

    if (rows.length === 0) {
      return staticExperience
    }

    return rows.map((row) => ({
      org: row.org,
      role: row.role,
      location: row.location,
      period: row.period,
      summary: row.summary,
      details: parseDetails(row.details),
    }))
  } catch {
    return staticExperience
  }
}

export async function listAdminExperience() {
  return db
    .select()
    .from(experienceEntries)
    .orderBy(experienceEntries.sortOrder)
}

function yearFrom(date: Date | string | null, fallback: string) {
  if (!date) return fallback
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return fallback
  return String(value.getFullYear())
}

export async function getPublishedPapers(): Promise<PublicPaper[]> {
  if (!process.env.DATABASE_URL) {
    return staticPublicPapers()
  }

  try {
    const rows = await db
      .select()
      .from(paperEntries)
      .where(eq(paperEntries.published, true))
      .orderBy(desc(paperEntries.date))

    if (rows.length === 0) {
      return staticPublicPapers()
    }

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      category: row.category,
      year: row.year || yearFrom(row.date, ""),
      type: row.type,
      excerpt: row.excerpt || row.abstract,
      tags: parseTags(row.tags || row.methods),
      pdfUrl: row.pdfUrl,
      date: row.date.toISOString(),
    }))
  } catch {
    return staticPublicPapers()
  }
}

export async function getPublishedProjects(): Promise<PublicProject[]> {
  if (!process.env.DATABASE_URL) {
    return staticPublicProjects()
  }

  try {
    const rows = await db
      .select()
      .from(projectEntries)
      .where(eq(projectEntries.published, true))
      .orderBy(desc(projectEntries.date))

    if (rows.length === 0) {
      return staticPublicProjects()
    }

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      category: row.category,
      summary: row.summary || row.excerpt,
      tags: parseTags(row.tags),
      status: row.status,
      kind: (row.kind as PublicProject["kind"]) ?? "dashboard",
      pdfUrl: row.pdfUrl,
      date: row.date.toISOString(),
    }))
  } catch {
    return staticPublicProjects()
  }
}

export async function getPublicPaperBySlug(
  slug: string,
): Promise<PublicPaperDetail | null> {
  if (!process.env.DATABASE_URL) {
    return staticPublicPaperDetails().find((p) => p.slug === slug) ?? null
  }

  try {
    const rows = await db
      .select()
      .from(paperEntries)
      .where(and(eq(paperEntries.slug, slug), eq(paperEntries.published, true)))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      slug: row.slug,
      title: row.title,
      category: row.category,
      year: row.year || yearFrom(row.date, ""),
      type: row.type,
      excerpt: row.excerpt || row.abstract,
      tags: parseTags(row.tags || row.methods),
      pdfUrl: row.pdfUrl,
      date: row.date.toISOString(),
      abstract: row.abstract || row.excerpt,
      contentType: row.contentType,
      latexSource: row.latexSource,
      pdfFilename: row.pdfFilename,
    }
  } catch {
    return null
  }
}

export async function getPublicProjectBySlug(
  slug: string,
): Promise<PublicProjectDetail | null> {
  if (!process.env.DATABASE_URL) {
    return staticPublicProjectDetails().find((p) => p.slug === slug) ?? null
  }

  try {
    const rows = await db
      .select()
      .from(projectEntries)
      .where(
        and(eq(projectEntries.slug, slug), eq(projectEntries.published, true)),
      )
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      slug: row.slug,
      title: row.title,
      category: row.category,
      summary: row.summary || row.excerpt,
      tags: parseTags(row.tags),
      status: row.status,
      kind: (row.kind as PublicProject["kind"]) ?? "dashboard",
      pdfUrl: row.pdfUrl,
      date: row.date.toISOString(),
      excerpt: row.excerpt || row.summary,
      contentType: row.contentType,
      latexSource: row.latexSource,
      pdfFilename: row.pdfFilename,
    }
  } catch {
    return null
  }
}

export async function listAdminPapers() {
  return db.select().from(paperEntries).orderBy(desc(paperEntries.updatedAt))
}

export async function listAdminProjects() {
  return db.select().from(projectEntries).orderBy(desc(projectEntries.updatedAt))
}

export { paperCategories }
