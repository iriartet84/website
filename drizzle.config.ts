import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// drizzle-kit runs as a standalone Node CLI (not through `next dev`/`next
// build`), so it never gets Next.js's automatic .env.local loading — that's
// a Next-specific convenience, not a Node one. Load it explicitly here.
config({ path: ".env.local" })

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
