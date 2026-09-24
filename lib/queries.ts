import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  paperEntries,
  projectEntries,
  experienceEntries,
  educationEntries,
  languageEntries,
  cvProfile,
} from "@/lib/db/schema"
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
import {
  experience as staticExperience,
  education as staticEducation,
  languages as staticLanguages,
  profile as staticProfile,
  cvSkills as staticCvSkills,
} from "@/lib/content"
import { parseTags, parseDetails } from "@/lib/validations"

// The cv_profile table only ever has this one row.
const CV_PROFILE_ID = 1

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

export type PublicEducation = {
  school: string
  location: string
  degree: string
  period: string
  details: string[]
}

export async function getPublishedEducation(): Promise<PublicEducation[]> {
  if (!process.env.DATABASE_URL) {
    return staticEducation
  }

  try {
    const rows = await db
      .select()
      .from(educationEntries)
      .where(eq(educationEntries.published, true))
      .orderBy(educationEntries.sortOrder)

    if (rows.length === 0) {
      return staticEducation
    }

    return rows.map((row) => ({
      school: row.school,
      location: row.location,
      degree: row.degree,
      period: row.period,
      details: parseDetails(row.details),
    }))
  } catch {
    return staticEducation
  }
}

export async function listAdminEducation() {
  return db
    .select()
    .from(educationEntries)
    .orderBy(educationEntries.sortOrder)
}

export type PublicLanguage = {
  name: string
  level: string
}

export async function getPublishedLanguages(): Promise<PublicLanguage[]> {
  if (!process.env.DATABASE_URL) {
    return staticLanguages
  }

  try {
    const rows = await db
      .select()
      .from(languageEntries)
      .where(eq(languageEntries.published, true))
      .orderBy(languageEntries.sortOrder)

    if (rows.length === 0) {
      return staticLanguages
    }

    return rows.map((row) => ({ name: row.name, level: row.level }))
  } catch {
    return staticLanguages
  }
}

export async function listAdminLanguages() {
  return db.select().from(languageEntries).orderBy(languageEntries.sortOrder)
}

export type PublicCvProfile = {
  tagline: string
  nationality: string
  location: string
  email: string
  phone: string
  linkedin: string
  linkedinUrl: string
  programming: string[]
  methods: string[]
  // Null when no CV PDF has been uploaded yet. Points at this app's own
  // `/api/files/[key]` route (see app/api/files/[key]/route.ts) — never a
  // direct bucket URL, since the bucket is private — which resolves a
  // fresh presigned download URL at request time.
  cvPdfUrl: string | null
}

export async function getCvProfile(): Promise<PublicCvProfile> {
  const fallback: PublicCvProfile = {
    tagline: staticProfile.tagline,
    nationality: staticProfile.nationality,
    location: staticProfile.location,
    email: staticProfile.email,
    phone: staticProfile.phone,
    linkedin: staticProfile.linkedin,
    linkedinUrl: staticProfile.linkedinUrl,
    programming: staticCvSkills.programming,
    methods: staticCvSkills.methods,
    cvPdfUrl: null,
  }

  if (!process.env.DATABASE_URL) {
    return fallback
  }

  try {
    const rows = await db
      .select()
      .from(cvProfile)
      .where(eq(cvProfile.id, CV_PROFILE_ID))
      .limit(1)

    const row = rows[0]
    if (!row) return fallback

    return {
      tagline: row.tagline || fallback.tagline,
      nationality: row.nationality || fallback.nationality,
      location: row.location || fallback.location,
      email: row.email || fallback.email,
      phone: row.phone || fallback.phone,
      linkedin: row.linkedin || fallback.linkedin,
      linkedinUrl: row.linkedinUrl || fallback.linkedinUrl,
      programming: row.programmingSkills
        ? parseDetails(row.programmingSkills)
        : fallback.programming,
      methods: row.methodSkills
        ? parseDetails(row.methodSkills)
        : fallback.methods,
      cvPdfUrl: row.cvPdfPathname
        ? `/api/files/${encodeURIComponent(row.cvPdfPathname)}?download=1&filename=${encodeURIComponent(row.cvPdfFilename || "CV.pdf")}`
        : null,
    }
  } catch {
    return fallback
  }
}

export async function getAdminCvProfile() {
  if (!process.env.DATABASE_URL) return null
  const rows = await db
    .select()
    .from(cvProfile)
    .where(eq(cvProfile.id, CV_PROFILE_ID))
    .limit(1)
  return rows[0] ?? null
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
      .orderBy(paperEntries.sortOrder, desc(paperEntries.date))

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
      .orderBy(projectEntries.sortOrder, desc(projectEntries.date))

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
  } catch (error) {
    // Deliberately not swallowed into `return null` here: null means "this
    // slug genuinely doesn't exist" and the page turns that into a clean
    // 404. A DB connection failure is a different situation entirely and
    // showing it as "page not found" hides a real, fixable problem — let
    // the page catch this and show an actual error state instead.
    throw error instanceof Error ? error : new Error("Failed to load paper")
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
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to load project")
  }
}

export async function listAdminPapers() {
  return db
    .select()
    .from(paperEntries)
    .orderBy(paperEntries.sortOrder, desc(paperEntries.date))
}

export async function listAdminProjects() {
  return db
    .select()
    .from(projectEntries)
    .orderBy(projectEntries.sortOrder, desc(projectEntries.date))
}

export { paperCategories }
