import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { siteContent } from "@/lib/db/schema"
import {
  defaultHomeContent,
  defaultListPageContent,
  homeContentSchema,
  listPageContentSchema,
  type HomeContent,
  type ListPageContent,
  type ListPageKey,
} from "@/lib/site-content-shared"

// Server-side readers for the `site_content` table. Every failure mode —
// no DATABASE_URL, the table not migrated yet, no row, or a row that no
// longer matches the schema — falls back to the built-in defaults, the
// same way lib/queries.ts falls back to lib/content.ts for the CV.

async function readValue(key: string): Promise<unknown | null> {
  if (!process.env.DATABASE_URL) return null
  try {
    const [row] = await db
      .select({ value: siteContent.value })
      .from(siteContent)
      .where(eq(siteContent.key, key))
      .limit(1)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function getHomeContent(): Promise<HomeContent> {
  const value = await readValue("home")
  const parsed = homeContentSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultHomeContent
}

export async function getListPageContent(page: ListPageKey): Promise<ListPageContent> {
  const value = await readValue(page)
  const parsed = listPageContentSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultListPageContent[page]
}
