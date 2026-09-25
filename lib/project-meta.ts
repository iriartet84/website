import { z } from "zod"
import { paperCategories } from "@/lib/content"
import type { OutputHeadline, ProjectOutput } from "@/lib/project-output"

// Vocabulary and shapes for projects, shared by the public pages, the admin
// editors and the save actions. Nothing here names a programming language or
// hosting provider: a project is described by what it is (type, sector), how
// visitors experience it (mode), the tools it shows off (languages, APIs,
// tools), and how it connects (links, output file, embed) — see
// lib/project-output.ts for the output-file contract. Client-safe.

// Sectors are shared with Papers & Briefs, so a project's "nature" tag reads
// the same as a paper's category.
export const projectSectors = paperCategories

export const projectTypes = [
  { value: "research", label: "Research" },
  { value: "analysis", label: "Interactive analysis" },
  { value: "dashboard", label: "Dashboard" },
  { value: "nowcast", label: "Nowcast" },
  { value: "model", label: "Model" },
  { value: "data", label: "Data project" },
  { value: "map", label: "Map" },
  { value: "application", label: "Live application" },
] as const
export type ProjectType = (typeof projectTypes)[number]["value"]

export const projectModes = [
  { value: "static", label: "Static" },
  { value: "interactive", label: "Interactive" },
  { value: "live", label: "Live" },
  { value: "automated", label: "Automatically updated" },
] as const
export type ProjectMode = (typeof projectModes)[number]["value"]

// Existing `status` column = lifecycle. "Live" means launched; only the two
// unfinished states are shown as a badge (so it never clashes with the
// "Live" mode).
export const projectLifecycles = ["In progress", "Coming soon", "Live"] as const

export const updateFrequencies = [
  { value: "daily", label: "Daily", maxAgeHours: 36 },
  { value: "weekly", label: "Weekly", maxAgeHours: 24 * 9 },
  { value: "monthly", label: "Monthly", maxAgeHours: 24 * 35 },
  { value: "quarterly", label: "Quarterly", maxAgeHours: 24 * 100 },
  { value: "irregular", label: "Irregular", maxAgeHours: null },
] as const
export type UpdateFrequency = (typeof updateFrequencies)[number]["value"]

export const linkKinds = [
  { value: "repository", label: "Repository" },
  { value: "application", label: "Live app" },
  { value: "documentation", label: "Documentation" },
  { value: "paper", label: "Paper" },
  { value: "dataset", label: "Dataset" },
  { value: "other", label: "Link" },
] as const
export type LinkKind = (typeof linkKinds)[number]["value"]

export function labelOf<T extends { value: string; label: string }>(list: readonly T[], value: string) {
  return list.find((item) => item.value === value)?.label ?? value
}

// ---- Validation ----------------------------------------------------------

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => /^https:\/\/[^\s]+$/.test(value), "Links must be https:// addresses")

export const projectLinkSchema = z.object({
  kind: z.enum(linkKinds.map((k) => k.value) as [LinkKind, ...LinkKind[]]),
  label: z.string().trim().max(60),
  url: httpsUrl,
})
export type ProjectLink = z.infer<typeof projectLinkSchema>

export const stackListSchema = z
  .array(z.string().trim().min(1, "Tags can't be empty").max(40, "A tag is too long"))
  .max(20, "Too many tags (20 max)")

const sectionId = z.string().min(1).max(80)
const heading = z.string().trim().max(120)

// The typed sections of a project page, in display order. Sections whose
// data isn't there (a chart without output, an app without an embed URL)
// are skipped on the public page, so a static project and a live one use
// the same page template.
export const projectSectionSchema = z.discriminatedUnion("type", [
  // Markdown with $inline$ and $$display$$ maths.
  z.object({ id: sectionId, type: z.literal("text"), heading, body: z.string().max(20000) }),
  // Headline tiles from the stored output; empty `ids` = all headline figures.
  z.object({ id: sectionId, type: z.literal("figures"), heading, ids: z.array(z.string().max(60)).max(12) }),
  z.object({
    id: sectionId,
    type: z.literal("chart"),
    heading,
    seriesIds: z.array(z.string().max(60)).max(4, "A chart shows at most 4 series"),
    kind: z.enum(["line", "bar"]),
    note: z.string().trim().max(300),
  }),
  // The project's embedUrl, in a frame loaded on click.
  z.object({ id: sectionId, type: z.literal("app"), heading, height: z.number().int().min(300).max(1600) }),
  z.object({
    id: sectionId,
    type: z.literal("findings"),
    heading,
    items: z.array(z.string().trim().min(1).max(600)).max(20),
  }),
  z.object({
    id: sectionId,
    type: z.literal("sources"),
    heading,
    items: z
      .array(z.object({ label: z.string().trim().min(1).max(200), url: z.union([httpsUrl, z.literal("")]) }))
      .max(30),
  }),
  // Links listed here plus any `downloads` in the stored output.
  z.object({
    id: sectionId,
    type: z.literal("downloads"),
    heading,
    items: z.array(z.object({ label: z.string().trim().min(1).max(120), url: httpsUrl })).max(20),
  }),
  // The existing PDF/LaTeX document fields.
  z.object({ id: sectionId, type: z.literal("document"), heading }),
])
export type ProjectSection = z.infer<typeof projectSectionSchema>
export type ProjectSectionType = ProjectSection["type"]

export const sectionTypes: { value: ProjectSectionType; label: string; hint: string }[] = [
  { value: "text", label: "Text", hint: "Overview, methodology, interpretation — Markdown and equations" },
  { value: "figures", label: "Key figures", hint: "Headline numbers from the project's output file" },
  { value: "chart", label: "Chart", hint: "Series from the project's output file" },
  { value: "app", label: "Live app", hint: "The project's deployed app, embedded" },
  { value: "findings", label: "Findings", hint: "A short list of key results" },
  { value: "sources", label: "Data sources", hint: "Where the data comes from" },
  { value: "downloads", label: "Downloads", hint: "Datasets and files to download" },
  { value: "document", label: "Document", hint: "The project's PDF or LaTeX document" },
]

export function newSection(type: ProjectSectionType, id: string): ProjectSection {
  switch (type) {
    case "text":
      return { id, type, heading: "Methodology", body: "" }
    case "figures":
      return { id, type, heading: "Latest results", ids: [] }
    case "chart":
      return { id, type, heading: "", seriesIds: [], kind: "line", note: "" }
    case "app":
      return { id, type, heading: "Interactive app", height: 720 }
    case "findings":
      return { id, type, heading: "Key findings", items: [""] }
    case "sources":
      return { id, type, heading: "Data sources", items: [] }
    case "downloads":
      return { id, type, heading: "Downloads", items: [] }
    case "document":
      return { id, type, heading: "Document" }
  }
}

// Starting layout for a new project: every section a live project usually
// needs. The ones without data yet stay hidden from visitors.
export function defaultSections(): ProjectSection[] {
  return [
    { id: "overview", type: "text", heading: "Overview", body: "" },
    { id: "figures", type: "figures", heading: "Latest results", ids: [] },
    { id: "chart", type: "chart", heading: "", seriesIds: [], kind: "line", note: "" },
    { id: "methodology", type: "text", heading: "Methodology", body: "" },
    { id: "sources", type: "sources", heading: "Data sources", items: [] },
  ]
}

// Home's Featured Projects: the first featured project of each sector, in
// sector order (projects arrive in page order).
export function featuredBySector<T extends { category: string }>(projects: T[]): T[] {
  const seen = new Set<string>()
  const picked = projects.filter((project) => {
    if (seen.has(project.category)) return false
    seen.add(project.category)
    return true
  })
  const rank = (category: string) => {
    const index = (projectSectors as readonly string[]).indexOf(category)
    return index === -1 ? projectSectors.length : index
  }
  return picked.sort((a, b) => rank(a.category) - rank(b.category))
}

// PROJECT_EMBED_ORIGINS: comma-separated https origins whose apps may be
// framed on project pages (next.config.mjs adds them to the CSP frame-src
// with the same parsing), e.g. "https://iriartet84.github.io".
export function parseEmbedOrigins(value: string | undefined) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((item) => {
      try {
        const url = new URL(item)
        return url.protocol === "https:" ? url.origin : null
      } catch {
        return null
      }
    })
    .filter((origin): origin is string => origin !== null)
}

// ---- Stored output → what cards and the page need --------------------------

// What a card or featured preview shows from the stored output: the first
// headline figure and a short series for the sparkline — not the whole file.
export type OutputSummary = {
  updatedAt: string
  headline: OutputHeadline | null
  spark: number[]
}

export function summariseOutput(output: ProjectOutput | null): OutputSummary | null {
  if (!output) return null
  const series = output.series?.[0]
  const spark = series
    ? series.points
        .map((p) => p[1])
        .filter((v): v is number => typeof v === "number")
        .slice(-60)
    : []
  return { updatedAt: output.updatedAt, headline: output.headline?.[0] ?? null, spark }
}

export type OutputHealth = "none" | "current" | "overdue" | "failing"

// "overdue" = older than the stated update frequency allows; "failing" = the
// last fetch failed (the page keeps showing the previous valid output).
export function outputHealth(input: {
  outputUrl: string | null
  output: { updatedAt: string } | null
  outputError: string | null
  updateFrequency: string | null
  now?: Date
}): OutputHealth {
  if (!input.outputUrl) return "none"
  if (input.outputError) return "failing"
  if (!input.output) return "failing"
  const frequency = updateFrequencies.find((f) => f.value === input.updateFrequency)
  if (frequency?.maxAgeHours) {
    const age = ((input.now ?? new Date()).getTime() - Date.parse(input.output.updatedAt)) / 3_600_000
    if (age > frequency.maxAgeHours) return "overdue"
  }
  return "current"
}

const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// "23 Sep 2026", in UTC. Built by hand rather than with Intl so the server
// and every browser produce exactly the same text (ICU versions disagree,
// e.g. "Sep" vs "Sept"), which keeps hydration consistent.
export function formatAbsoluteDate(iso: string) {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso
  const date = new Date(time)
  return `${date.getUTCDate()} ${monthAbbreviations[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

export function formatValue(value: number | string, unit?: string) {
  if (typeof value === "string") return value
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  const text = value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 })
  if (!unit) return text
  return unit.startsWith("%") ? `${text}${unit}` : `${text} ${unit}`
}

export function formatChange(change: number, unit?: string) {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±"
  return `${sign}${formatValue(Math.abs(change), unit?.startsWith("%") ? unit.split(" ")[0] : unit)}`
}
