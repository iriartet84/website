import { z } from "zod"

// The output-file contract between a project and the portfolio
// ("portfolio-output/1"). A project — in any language — publishes one JSON
// file in this shape at a stable HTTPS URL (normally its repository's GitHub
// Pages site); the portfolio fetches it server-side, validates it with the
// schema below and stores the last valid copy (see lib/project-refresh.ts).
//
// The same rules are published as a JSON Schema at
// /schemas/portfolio-output-1.json (generated from this file by
// `npm run schema:output`) and enforced by the validator in
// project-template/scripts/validate-output.mjs.
//
// Compatibility: fields are only ever added. Unknown fields are ignored (and
// dropped when stored), so a project can publish extra data for its own app
// without breaking the site. A breaking change would be a new
// "portfolio-output/2", supported alongside this one.
//
// This module is client-safe (no server imports).

export const OUTPUT_SCHEMA = "portfolio-output/1"
export const MAX_OUTPUT_BYTES = 1024 * 1024

const text = (max: number) => z.string().trim().min(1).max(max)
// Patterns (not only refinements) so they carry over to the JSON Schema.
const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .regex(/^https:\/\/\S+$/, "must be an https:// URL")

// A date ("2026-09-23") or a date-time with timezone ("2026-09-23T06:10:00Z").
const isoDate = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/,
    "must be an ISO date (2026-09-23) or date-time with timezone (2026-09-23T06:00:00Z)",
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), "is not a real date")

export const outputHeadlineSchema = z.object({
  id: text(60),
  label: text(120),
  // Usually a number; text allows values like "Expansion" or "n/a yet".
  value: z.union([z.number().finite(), text(60)]),
  unit: z.string().trim().max(30).optional(),
  // Change since the previous estimate, in the same unit.
  change: z.number().finite().optional(),
  asOf: isoDate.optional(),
  note: z.string().trim().max(200).optional(),
})

// x is a date (time series) or a number (e.g. quarters after a shock).
const xValue = z.union([isoDate, z.number().finite()])
const yValue = z.number().finite().nullable()
// [x, y] or [x, y, lower, upper] — the last two draw an uncertainty band.
const point = z.union([
  z.tuple([xValue, yValue]),
  z.tuple([xValue, yValue, z.number().finite(), z.number().finite()]),
])

export const outputSeriesSchema = z.object({
  id: text(60),
  label: text(120),
  unit: z.string().trim().max(30).optional(),
  points: z.array(point).min(1).max(5000),
})

export const outputDownloadSchema = z.object({
  label: text(120),
  url: httpsUrl,
})

export const projectOutputSchema = z.object({
  schema: z.literal(OUTPUT_SCHEMA),
  updatedAt: isoDate,
  status: z.enum(["ok", "degraded", "error"]).optional(),
  headline: z.array(outputHeadlineSchema).max(12).optional(),
  series: z.array(outputSeriesSchema).max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  downloads: z.array(outputDownloadSchema).max(20).optional(),
})

export type ProjectOutput = z.infer<typeof projectOutputSchema>
export type OutputHeadline = z.infer<typeof outputHeadlineSchema>
export type OutputSeries = z.infer<typeof outputSeriesSchema>

// First validation problem, phrased for the admin ("series[0].points: …").
export function describeOutputProblem(error: z.ZodError) {
  const issue = error.issues[0]
  if (!issue) return "The file doesn't match the portfolio-output/1 format."
  const path = issue.path
    .map((part, i) => (typeof part === "number" ? `[${part}]` : `${i ? "." : ""}${String(part)}`))
    .join("")
  if (path === "schema") return `"schema" must be "${OUTPUT_SCHEMA}".`
  return `${path || "file"}: ${issue.message}`
}

export function parseProjectOutput(value: unknown) {
  return projectOutputSchema.safeParse(value)
}
