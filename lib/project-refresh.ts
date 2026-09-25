import { revalidatePath } from "next/cache"
import { and, eq, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { projectEntries } from "@/lib/db/schema"
import {
  MAX_OUTPUT_BYTES,
  describeOutputProblem,
  parseProjectOutput,
  type ProjectOutput,
} from "@/lib/project-output"

// Server side of the project pipeline: fetch a project's output file,
// validate it against portfolio-output/1, and store the last valid copy.
//
// Pages never fetch a project's output while rendering — they read the copy
// stored here — so a project that is down, slow or publishes a broken file
// can't break or slow down the portfolio. A failed fetch records the error
// (shown in admin) and keeps the previous valid output on the page.
//
// Called from:
//   - /api/projects/refresh — pinged by a project's GitHub Actions workflow
//     after it deploys new output, and by the scheduled Netlify function
//     (netlify/functions/refresh-project-outputs.mts) as a safety net;
//   - the admin project editor ("Check now", and on save when the URL
//     changes).

const FETCH_TIMEOUT_MS = 10_000

export type FetchOutputResult =
  | { ok: true; output: ProjectOutput }
  | { ok: false; error: string }

// Hosts an output file can never live on. Only a light guard — the URL is
// entered by the admin, not by visitors.
function isDisallowedHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe80:/.test(host)
  )
}

export function checkOutputUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return "Not a valid URL."
  }
  if (url.protocol !== "https:") return "The output URL must start with https://."
  if (url.username || url.password) return "The output URL can't contain credentials."
  if (isDisallowedHost(url.hostname)) return "The output URL must be a public address."
  return null
}

async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_OUTPUT_BYTES) return null
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_OUTPUT_BYTES) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

// Fetches and validates an output file. Never throws.
export async function fetchProjectOutput(outputUrl: string): Promise<FetchOutputResult> {
  const problem = checkOutputUrl(outputUrl)
  if (problem) return { ok: false, error: problem }

  // Cache-buster: GitHub Pages sits behind a CDN that caches for ~10 min;
  // the query string makes it return the freshly deployed file.
  const url = new URL(outputUrl)
  url.searchParams.set("portfolio_t", String(Date.now()))

  let response: Response
  try {
    response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return {
      ok: false,
      error: timedOut
        ? `No response within ${FETCH_TIMEOUT_MS / 1000} seconds.`
        : "Couldn't reach the output URL.",
    }
  }

  if (response.url && checkOutputUrl(response.url)) {
    return { ok: false, error: "The output URL redirected to a non-public or non-https address." }
  }
  if (!response.ok) {
    return { ok: false, error: `The output URL answered HTTP ${response.status}.` }
  }

  const body = await readCapped(response).catch(() => undefined)
  if (body === undefined) return { ok: false, error: "The download was interrupted." }
  if (body === null) {
    return { ok: false, error: `The output file is larger than ${MAX_OUTPUT_BYTES / 1024 / 1024} MB.` }
  }

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return { ok: false, error: "The output file isn't valid JSON." }
  }

  const parsed = parseProjectOutput(json)
  if (!parsed.success) return { ok: false, error: describeOutputProblem(parsed.error) }
  return { ok: true, output: parsed.data }
}

export type RefreshResult = {
  slug: string
  ok: boolean
  // True when what visitors see changed (new output, or error state changed).
  changed: boolean
  updatedAt?: string
  error?: string
}

type RefreshRow = {
  id: number
  slug: string
  outputUrl: string | null
  output: unknown
  outputError: string | null
}

function storedUpdatedAt(output: unknown) {
  const parsed = parseProjectOutput(output)
  return parsed.success ? parsed.data.updatedAt : null
}

export async function refreshRow(row: RefreshRow): Promise<RefreshResult> {
  if (!row.outputUrl) return { slug: row.slug, ok: false, changed: false, error: "No output URL set." }

  const result = await fetchProjectOutput(row.outputUrl)
  const now = new Date()

  if (!result.ok) {
    await db
      .update(projectEntries)
      .set({ outputCheckedAt: now, outputError: result.error })
      .where(eq(projectEntries.id, row.id))
    return { slug: row.slug, ok: false, changed: row.outputError !== result.error, error: result.error }
  }

  const changed = storedUpdatedAt(row.output) !== result.output.updatedAt || row.outputError !== null
  await db
    .update(projectEntries)
    .set(
      changed
        ? { output: result.output, outputCheckedAt: now, outputError: null }
        : { outputCheckedAt: now },
    )
    .where(eq(projectEntries.id, row.id))
  return { slug: row.slug, ok: true, changed, updatedAt: result.output.updatedAt }
}

export function revalidateProject(slug: string) {
  revalidatePath("/projects")
  revalidatePath(`/projects/${slug}`)
  revalidatePath("/")
}

const refreshColumns = {
  id: projectEntries.id,
  slug: projectEntries.slug,
  outputUrl: projectEntries.outputUrl,
  output: projectEntries.output,
  outputError: projectEntries.outputError,
}

// Refreshes one project (by slug) or every project with an output URL.
// Returns null when the slug doesn't exist or has no output URL.
export async function refreshProjects(
  target: { slug: string } | { all: true },
): Promise<RefreshResult[] | null> {
  const rows =
    "slug" in target
      ? await db
          .select(refreshColumns)
          .from(projectEntries)
          .where(and(eq(projectEntries.slug, target.slug), isNotNull(projectEntries.outputUrl)))
          .limit(1)
      : await db.select(refreshColumns).from(projectEntries).where(isNotNull(projectEntries.outputUrl))

  if ("slug" in target && rows.length === 0) return null

  // A few at a time: each fetch has its own timeout, and a scheduled run
  // must finish well within the function's time limit.
  const results: RefreshResult[] = []
  for (let i = 0; i < rows.length; i += 4) {
    const batch = rows.slice(i, i + 4)
    results.push(
      ...(await Promise.all(
        batch.map((row) =>
          refreshRow(row).catch(
            (): RefreshResult => ({ slug: row.slug, ok: false, changed: false, error: "Couldn't save the result." }),
          ),
        ),
      )),
    )
  }

  for (const result of results) {
    if (result.changed) revalidateProject(result.slug)
  }
  return results
}
