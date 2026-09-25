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
  staticPublicPaperDetails,
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
import { parseTags, parseDetails, skillGroupSchema, type SkillGroupInput } from "@/lib/validations"
import { parseProjectOutput, type ProjectOutput } from "@/lib/project-output"
import {
  projectLinkSchema,
  projectSectionSchema,
  stackListSchema,
  summariseOutput,
  type ProjectLink,
  type ProjectSection,
} from "@/lib/project-meta"

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

export type SkillGroup = { id: string; label: string; tags: string[] }

export type PublicCvProfile = {
  tagline: string
  nationality: string
  location: string
  email: string
  phone: string
  linkedin: string
  linkedinUrl: string
  skillGroups: SkillGroup[]
  // Null when no CV PDF has been uploaded yet. Points at this app's own
  // `/api/files/[key]` route (see app/api/files/[key]/route.ts) — never a
  // direct bucket URL, since the bucket is private — which resolves a
  // fresh presigned download URL at request time.
  cvPdfUrl: string | null
}

const fallbackSkillGroups: SkillGroup[] = [
  { id: "programming", label: "Programming & Tools", tags: staticCvSkills.programming },
  { id: "methods", label: "Econometric & ML Methods", tags: staticCvSkills.methods },
]

export async function getCvProfile(): Promise<PublicCvProfile> {
  const fallback: PublicCvProfile = {
    tagline: staticProfile.tagline,
    nationality: staticProfile.nationality,
    location: staticProfile.location,
    email: staticProfile.email,
    phone: staticProfile.phone,
    linkedin: staticProfile.linkedin,
    linkedinUrl: staticProfile.linkedinUrl,
    skillGroups: fallbackSkillGroups,
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

    // skillGroups is the source of truth once anything has been saved from
    // the new editor. Until then, fall back to the two older columns (so
    // skills entered before this feature existed aren't lost), then to the
    // built-in defaults.
    const savedGroups = validItems<SkillGroupInput>(row.skillGroups, skillGroupSchema)
    const legacyGroups: SkillGroup[] = [
      { id: "programming", label: "Programming & Tools", tags: row.programmingSkills ? parseDetails(row.programmingSkills) : [] },
      { id: "methods", label: "Econometric & ML Methods", tags: row.methodSkills ? parseDetails(row.methodSkills) : [] },
    ].filter((group) => group.tags.length > 0)

    return {
      tagline: row.tagline || fallback.tagline,
      nationality: row.nationality || fallback.nationality,
      location: row.location || fallback.location,
      email: row.email || fallback.email,
      phone: row.phone || fallback.phone,
      linkedin: row.linkedin || fallback.linkedin,
      linkedinUrl: row.linkedinUrl || fallback.linkedinUrl,
      skillGroups: savedGroups.length > 0 ? savedGroups : legacyGroups.length > 0 ? legacyGroups : fallback.skillGroups,
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

type ProjectRow = typeof projectEntries.$inferSelect

function stringList(value: unknown): string[] {
  const parsed = stackListSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

function storedOutput(value: unknown): ProjectOutput | null {
  if (value === null || value === undefined) return null
  const parsed = parseProjectOutput(value)
  return parsed.success ? parsed.data : null
}

// Keeps whichever stored items are still valid, so one bad entry (e.g. from
// an older shape) never takes the whole page down.
function validItems<T>(value: unknown, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = schema.safeParse(item)
    return parsed.success ? [parsed.data as T] : []
  })
}

function toPublicProject(row: ProjectRow, output: ProjectOutput | null): PublicProject {
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
    projectType: row.projectType,
    mode: row.mode,
    languages: stringList(row.languages),
    apis: stringList(row.apis),
    featured: row.featured,
    updateFrequency: row.updateFrequency,
    output: summariseOutput(output),
  }
}

// Projects have no built-in examples: with nothing published (or no
// database configured) /projects shows its empty state. A database error
// is thrown so the page can say so instead of looking empty.
export async function getPublishedProjects(): Promise<PublicProject[]> {
  if (!process.env.DATABASE_URL) return []

  const rows = await db
    .select()
    .from(projectEntries)
    .where(eq(projectEntries.published, true))
    .orderBy(projectEntries.sortOrder, desc(projectEntries.date))

  return rows.map((row) => toPublicProject(row, storedOutput(row.output)))
}

// Published projects marked as featured, in page order. Home shows the
// first one per sector, and falls back to Research Focus when there are
// none (or the database is unavailable).
export async function getFeaturedProjects(): Promise<PublicProject[]> {
  if (!process.env.DATABASE_URL) return []
  try {
    const rows = await db
      .select()
      .from(projectEntries)
      .where(and(eq(projectEntries.published, true), eq(projectEntries.featured, true)))
      .orderBy(projectEntries.sortOrder, desc(projectEntries.date))
    return rows.map((row) => toPublicProject(row, storedOutput(row.output)))
  } catch {
    return []
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
  if (!process.env.DATABASE_URL) return null

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

    const output = storedOutput(row.output)
    return {
      ...toPublicProject(row, output),
      excerpt: row.excerpt || row.summary,
      contentType: row.contentType,
      latexSource: row.latexSource,
      pdfFilename: row.pdfFilename,
      links: validItems<ProjectLink>(row.links, projectLinkSchema),
      embedUrl: row.embedUrl,
      sections: validItems<ProjectSection>(row.sections, projectSectionSchema),
      fullOutput: output,
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
