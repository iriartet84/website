import { z } from "zod"

export const MAX_PDF_BYTES = 8 * 1024 * 1024
export const MAX_LATEX_CHARS = 200_000

export const contentTypeSchema = z.enum(["pdf", "latex"])

export const entryInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug with hyphens"),
  category: z.string().trim().min(2).max(80),
  tags: z.string().trim().max(400),
  date: z.string().trim().min(4).max(10),
  excerpt: z.string().trim().min(20).max(2000),
  contentType: contentTypeSchema,
  type: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  kind: z.enum(["map", "chart", "dashboard", "model"]).optional(),
  latexSource: z.string().max(MAX_LATEX_CHARS).optional(),
  sortOrder: z.coerce.number().int().default(0),
  published: z.boolean().optional(),
})

export type EntryInput = z.infer<typeof entryInputSchema>

export function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export const experienceInputSchema = z.object({
  org: z.string().trim().min(2).max(150),
  role: z.string().trim().min(2).max(150),
  location: z.string().trim().max(150).optional(),
  period: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(400).optional(),
  details: z.string().trim().max(4000),
  sortOrder: z.coerce.number().int().default(0),
  published: z.boolean().optional(),
})

export type ExperienceInput = z.infer<typeof experienceInputSchema>

// Bullets are stored as one newline-separated text field, the same trick
// `tags` uses with commas — simplest thing that works for a single admin
// editing through a textarea, no separate bullets table needed.
export function parseDetails(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export const educationInputSchema = z.object({
  school: z.string().trim().min(2).max(200),
  location: z.string().trim().max(150).optional(),
  degree: z.string().trim().min(2).max(300),
  period: z.string().trim().min(2).max(80),
  details: z.string().trim().max(4000),
  sortOrder: z.coerce.number().int().default(0),
  published: z.boolean().optional(),
})

export type EducationInput = z.infer<typeof educationInputSchema>

export const languageInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  level: z.string().trim().min(1).max(60),
  sortOrder: z.coerce.number().int().default(0),
  published: z.boolean().optional(),
})

export type LanguageInput = z.infer<typeof languageInputSchema>

export const cvProfileInputSchema = z.object({
  tagline: z.string().trim().min(10).max(600),
  nationality: z.string().trim().max(150).optional(),
  location: z.string().trim().max(150).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  linkedin: z.string().trim().max(150).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
  // Skills textareas use the same one-per-line convention as `details`.
  programmingSkills: z.string().trim().max(2000),
  methodSkills: z.string().trim().max(2000),
})

export type CvProfileInput = z.infer<typeof cvProfileInputSchema>

// ---- Page editor payloads (app/admin/editor-actions.ts) -------------------
//
// The admin page editors save a whole page at once. These schemas validate
// those payloads, with messages written to be shown to the editor as-is
// (they're prefixed with the item they belong to — see editor-actions.ts).
// Field rules match the older per-entry schemas above.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const bulletsSchema = z
  .array(z.string().trim().min(1).max(1000))
  .max(20, "Too many bullet points (20 max)")

const tagListSchema = z
  .array(z.string().trim().min(1, "Tags can't be empty").max(60, "A tag is too long"))
  .max(20, "Too many tags (20 max)")

const clientKeySchema = z.string().min(1).max(80)
const rowIdSchema = z.number().int().positive().nullable()

export const documentChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keep") }),
  z.object({
    kind: z.literal("upload"),
    key: z.string().min(1).max(300),
    filename: z.string().trim().min(1).max(200),
  }),
  z.object({
    kind: z.literal("latex"),
    source: z.string().trim().min(1, "LaTeX source is empty").max(MAX_LATEX_CHARS),
  }),
])

const entryTitle = z
  .string()
  .trim()
  .min(3, "Title needs at least 3 characters")
  .max(200, "Title is too long")
const entrySlug = z
  .string()
  .trim()
  .min(3, "Slug needs at least 3 characters")
  .max(180, "Slug is too long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words separated by hyphens")
const entryCategory = z
  .string()
  .trim()
  .min(2, "Category needs at least 2 characters")
  .max(80, "Category is too long")
const entryDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be a valid date")
const entryDescription = z
  .string()
  .trim()
  .min(20, "Description needs at least 20 characters")
  .max(2000, "Description is too long")

export const paperItemSchema = z.object({
  clientKey: clientKeySchema,
  id: rowIdSchema,
  title: entryTitle,
  slug: entrySlug,
  category: entryCategory,
  type: z.enum(["Paper", "Report", "Brief"]),
  date: entryDate,
  excerpt: entryDescription,
  tags: tagListSchema,
  published: z.boolean(),
  document: documentChangeSchema,
})

export const projectItemSchema = z.object({
  clientKey: clientKeySchema,
  id: rowIdSchema,
  title: entryTitle,
  slug: entrySlug,
  category: entryCategory,
  status: z.enum(["Live", "In progress", "Coming soon"]),
  kind: z.enum(["map", "chart", "dashboard", "model"]),
  date: entryDate,
  summary: entryDescription,
  tags: tagListSchema,
  published: z.boolean(),
  document: documentChangeSchema,
})

export const experienceItemSchema = z.object({
  clientKey: clientKeySchema,
  id: rowIdSchema,
  org: z.string().trim().min(2, "Organisation needs at least 2 characters").max(150),
  role: z.string().trim().min(2, "Role needs at least 2 characters").max(150),
  location: z.string().trim().max(150),
  period: z.string().trim().min(2, "Period needs at least 2 characters").max(80),
  summary: z.string().trim().max(400),
  details: bulletsSchema,
  published: z.boolean(),
})

export const educationItemSchema = z.object({
  clientKey: clientKeySchema,
  id: rowIdSchema,
  school: z.string().trim().min(2, "School needs at least 2 characters").max(200),
  location: z.string().trim().max(150),
  degree: z.string().trim().min(2, "Degree needs at least 2 characters").max(300),
  period: z.string().trim().min(2, "Period needs at least 2 characters").max(80),
  details: bulletsSchema,
  published: z.boolean(),
})

export const languageItemSchema = z.object({
  clientKey: clientKeySchema,
  id: rowIdSchema,
  name: z.string().trim().min(2, "Language needs at least 2 characters").max(80),
  level: z.string().trim().min(1, "Level can't be empty").max(60),
  published: z.boolean(),
})

export const cvProfileEditorSchema = z.object({
  tagline: z
    .string()
    .trim()
    .min(10, "Description needs at least 10 characters")
    .max(600, "Description is too long"),
  nationality: z.string().trim().max(150),
  location: z.string().trim().max(150),
  email: z.string().trim().email("Email address isn't valid").or(z.literal("")),
  phone: z.string().trim().max(40),
  linkedin: z.string().trim().max(150),
  linkedinUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "LinkedIn URL must start with https://"),
  programming: tagListSchema.max(40, "Too many skills (40 max)"),
  methods: tagListSchema.max(40, "Too many skills (40 max)"),
})

export const cvPdfChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keep") }),
  z.object({
    kind: z.literal("upload"),
    key: z.string().min(1).max(300),
    filename: z.string().trim().min(1).max(200),
  }),
  z.object({ kind: z.literal("remove") }),
])

const deletedIdsSchema = z.array(z.number().int().positive()).max(500)

export const papersPagePayloadSchema = z.object({
  items: z.array(paperItemSchema).max(500),
  deletedIds: deletedIdsSchema,
})

export const projectsPagePayloadSchema = z.object({
  items: z.array(projectItemSchema).max(500),
  deletedIds: deletedIdsSchema,
})

export const cvPagePayloadSchema = z.object({
  profile: cvProfileEditorSchema,
  cvPdf: cvPdfChangeSchema,
  experience: z.object({ items: z.array(experienceItemSchema).max(100), deletedIds: deletedIdsSchema }),
  education: z.object({ items: z.array(educationItemSchema).max(100), deletedIds: deletedIdsSchema }),
  languages: z.object({ items: z.array(languageItemSchema).max(100), deletedIds: deletedIdsSchema }),
})

export type PaperItemInput = z.infer<typeof paperItemSchema>
export type ProjectItemInput = z.infer<typeof projectItemSchema>
export type ExperienceItemInput = z.infer<typeof experienceItemSchema>
export type EducationItemInput = z.infer<typeof educationItemSchema>
export type LanguageItemInput = z.infer<typeof languageItemSchema>
export type DocumentChange = z.infer<typeof documentChangeSchema>
export type CvPdfChange = z.infer<typeof cvPdfChangeSchema>
