import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

const STORE_NAME = "portfolio-files"
const LOCAL_DIR = path.join(process.cwd(), ".data", "blobs")

function isNetlify() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT)
}

// ---- S3-compatible storage (Backblaze B2, AWS S3, ...) --------------------
//
// Serving/uploading PDFs through a Next.js Server Action or Route Handler
// means every byte transits a Netlify Function, which buffers and
// base64-encodes binary bodies — capping the *effective* size well under
// the 8MB this app validates for (see MAX_PDF_BYTES in lib/validations.ts).
// When these env vars are set, PDFs are stored in a private S3-compatible
// bucket instead, and uploads/downloads go directly between the browser
// and the bucket via presigned URLs, bypassing that ceiling entirely — the
// bucket is never made public; every read is a short-lived presigned GET.
// Until the bucket is configured, everything falls back to the previous
// behavior (Netlify Blobs in production, the local filesystem in dev).
type S3Config = {
  bucket: string
  region: string
  endpoint?: string
  accessKeyId: string
  secretAccessKey: string
}

function s3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
  }
}

export function isS3Configured() {
  return s3Config() !== null
}

async function s3Client(cfg: S3Config) {
  const { S3Client } = await import("@aws-sdk/client-s3")
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    // B2 (and most other S3-compatible services) need path-style requests
    // — cfg.endpoint has no bucket in its host, so bucket.host/key would
    // resolve to the wrong place. Real AWS S3 (no custom endpoint) works
    // fine either way.
    forcePathStyle: Boolean(cfg.endpoint),
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

function pdfKeyFor(filename: string) {
  return `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
}

// Used by the admin UI to upload a PDF straight to the bucket from the
// browser, without the file ever passing through a Server Action. Returns
// null when no bucket is configured, so callers can fall back to the
// server-side upload path.
export async function createPresignedPdfUpload(filename: string) {
  const cfg = s3Config()
  if (!cfg) return null

  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")

  const key = pdfKeyFor(filename)
  const client = await s3Client(cfg)
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: "application/pdf",
    }),
    { expiresIn: 300 },
  )

  return { key, uploadUrl }
}

// Used by app/api/files/[key]/route.ts to hand back a short-lived download
// URL for a PDF stored in the bucket, rather than proxying the bytes
// through this app. Returns null when no bucket is configured, so the
// caller falls back to serving whatever's in the legacy store.
export async function createPresignedPdfDownload(
  key: string,
  options?: { filename?: string; download?: boolean },
) {
  const cfg = s3Config()
  if (!cfg) return null

  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")

  const filename = (options?.filename ?? key).replace(/"/g, "")
  const disposition = options?.download ? "attachment" : "inline"
  const client = await s3Client(cfg)
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `${disposition}; filename="${filename}"`,
    }),
    { expiresIn: 300 },
  )
}

// ---- Legacy storage (Netlify Blobs / local filesystem) --------------------
// Still used for: local dev, sites that haven't configured a bucket yet,
// and reading back any PDF that was stored before the S3 migration.

export async function savePdfBlob(filename: string, data: Buffer) {
  const key = pdfKeyFor(filename)

  if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    await store.set(key, new Blob([new Uint8Array(data)]), {
      metadata: { filename, contentType: "application/pdf" },
    })
  } else {
    await mkdir(LOCAL_DIR, { recursive: true })
    await writeFile(path.join(LOCAL_DIR, key), data)
  }

  return {
    key,
    url: `/api/files/${encodeURIComponent(key)}`,
  }
}

export async function readPdfBlob(key: string): Promise<Buffer | null> {
  if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    const value = await store.get(key, { type: "arrayBuffer" })
    return value ? Buffer.from(value) : null
  }

  try {
    return await readFile(path.join(LOCAL_DIR, key))
  } catch {
    return null
  }
}

// Deletes a PDF from whichever backend is currently active — the bucket
// once S3_BUCKET/etc. are configured, or the legacy store before that.
// Not yet called from any admin action (deleting a paper/project doesn't
// clean up its stored PDF) — that's a pre-existing gap, left as-is here.
export async function deletePdfBlob(key: string) {
  const cfg = s3Config()
  if (cfg) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const client = await s3Client(cfg)
    await client
      .send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
      .catch(() => undefined)
    return
  }

  if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    await store.delete(key)
    return
  }

  const { unlink } = await import("fs/promises")
  await unlink(path.join(LOCAL_DIR, key)).catch(() => undefined)
}
