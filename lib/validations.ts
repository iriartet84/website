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
