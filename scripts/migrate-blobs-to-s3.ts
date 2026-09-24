// One-time migration: copies existing paper/project/CV PDFs off Netlify
// Blobs / the local filesystem (lib/blobs.ts's legacy storage path) into
// the private S3-compatible bucket configured via S3_BUCKET/etc. The
// bucket is private, and pdfUrl/the CV's download link are both already
// just `/api/files/[key]` — the same path works before and after — so
// nothing in the database needs to change except cv_profile's row when it
// has no S3-backed PDF to begin with (see below); this script only needs
// to copy bytes into the bucket under the same key each row already uses.
//
// Run this BEFORE deploying with S3_BUCKET/etc. set for the first time:
// once those env vars are present, app/api/files/[key]/route.ts always
// tries a presigned bucket GET first, so any PDF not yet copied into the
// bucket will 403/404 until this has run.
//
// Safe to re-run — any key that already exists in the bucket is skipped.
//
// Run with:
//   node --env-file=.env.local --import tsx scripts/migrate-blobs-to-s3.ts
//
// Requires S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY to already be
// set (see .env.example). To migrate PDFs stored in Netlify Blobs
// (production), also set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN (a
// personal access token from https://app.netlify.com/user/applications)
// so this script — which normally runs *outside* Netlify's own
// infrastructure — can read that store directly.

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { readFile } from "fs/promises"
import path from "path"
import { db, pool } from "../lib/db"
import { paperEntries, projectEntries, cvProfile } from "../lib/db/schema"

const LOCAL_DIR = path.join(process.cwd(), ".data", "blobs")

function s3Config() {
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY before running this migration.",
    )
  }
  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
  }
}

async function readLegacyBlob(key: string): Promise<Buffer | null> {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (siteID && token) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore({ name: "portfolio-files", siteID, token })
    const value = await store.get(key, { type: "arrayBuffer" })
    return value ? Buffer.from(value) : null
  }

  try {
    return await readFile(path.join(LOCAL_DIR, key))
  } catch {
    return null
  }
}

async function alreadyInBucket(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function migrateKey(
  key: string,
  cfg: ReturnType<typeof s3Config>,
  client: S3Client,
) {
  if (await alreadyInBucket(client, cfg.bucket, key)) return "already in bucket"

  const data = await readLegacyBlob(key)
  if (!data) return `MISSING blob for key ${key}`

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: data,
      ContentType: "application/pdf",
    }),
  )
  return "migrated"
}

async function main() {
  const cfg = s3Config()
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: Boolean(cfg.endpoint),
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })

  const papers = await db
    .select({ id: paperEntries.id, title: paperEntries.title, pdfPathname: paperEntries.pdfPathname })
    .from(paperEntries)
  const projects = await db
    .select({ id: projectEntries.id, title: projectEntries.title, pdfPathname: projectEntries.pdfPathname })
    .from(projectEntries)
  const [cv] = await db
    .select({ id: cvProfile.id, cvPdfPathname: cvProfile.cvPdfPathname })
    .from(cvProfile)

  console.log(`Found ${papers.length} papers, ${projects.length} projects, CV ${cv?.cvPdfPathname ? "(has a PDF)" : "(no PDF)"}.\n`)

  for (const row of papers) {
    if (!row.pdfPathname) {
      console.log(`[paper #${row.id}] ${row.title}: skipped (no PDF)`)
      continue
    }
    console.log(`[paper #${row.id}] ${row.title}: ${await migrateKey(row.pdfPathname, cfg, client)}`)
  }
  for (const row of projects) {
    if (!row.pdfPathname) {
      console.log(`[project #${row.id}] ${row.title}: skipped (no PDF)`)
      continue
    }
    console.log(`[project #${row.id}] ${row.title}: ${await migrateKey(row.pdfPathname, cfg, client)}`)
  }
  if (cv?.cvPdfPathname) {
    console.log(`[CV]: ${await migrateKey(cv.cvPdfPathname, cfg, client)}`)
  } else {
    console.log(`[CV]: skipped (no PDF)`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
