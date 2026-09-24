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

function pdfKeyFor(filename: string, contentType: StoredContentType = "application/pdf") {
  let safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file"
  // Make sure the key ends in an extension matching the content type, since
  // that's what contentTypeForKey reads back (a "scan" or "photo.jpeg" file
  // name must still resolve to the type it was uploaded as).
  const expected =
    contentType === "application/pdf" ? ".pdf" : IMAGE_CONTENT_TYPES[contentType]
  if (contentTypeForKey(safe) !== contentType || !safe.includes(".")) {
    safe = `${safe}${expected}`
  }
  return `${randomUUID()}-${safe}`
}

// Content types this storage layer hands out. Uploaded keys keep the
// original file extension (see pdfKeyFor), which is how reads work out the
// type again without a database lookup. SVG is deliberately not allowed: it
// can carry script, and the legacy fallback serves files from this origin.
export const IMAGE_CONTENT_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
} as const

export type StoredContentType = "application/pdf" | keyof typeof IMAGE_CONTENT_TYPES

export function contentTypeForKey(key: string): StoredContentType {
  const lower = key.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "application/pdf"
}

// Keys are "<uuid>-<sanitised filename>" — the same shape for every file
// ever stored, so this also guards the /api/files/[key] route and the save
// actions against arbitrary strings being passed off as uploaded files.
export function isStorageKey(key: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9._-]{1,200}$/.test(key)
}

// Used by the admin UI to upload a file straight to the bucket from the
// browser, without the file ever passing through a Server Action. Returns
// null when no bucket is configured, so callers can fall back to the
// server-side upload path.
export async function createPresignedFileUpload(
  filename: string,
  contentType: StoredContentType,
) {
  const cfg = s3Config()
  if (!cfg) return null

  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")

  const key = pdfKeyFor(filename, contentType)
  const client = await s3Client(cfg)
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  )

  return { key, uploadUrl }
}

export async function createPresignedPdfUpload(filename: string) {
  return createPresignedFileUpload(filename, "application/pdf")
}

// Used by app/api/files/[key]/route.ts to hand back a short-lived download
// URL for a file stored in the bucket, rather than proxying the bytes
// through this app. Returns null when no bucket is configured, so the
// caller falls back to serving whatever's in the legacy store.
export async function createPresignedFileDownload(
  key: string,
  options?: { filename?: string; download?: boolean },
) {
  const cfg = s3Config()
  if (!cfg) return null

  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")

  const filename = (options?.filename ?? key).replace(/["\\\r\n]/g, "")
  const disposition = options?.download ? "attachment" : "inline"
  const client = await s3Client(cfg)
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ResponseContentType: contentTypeForKey(key),
      ResponseContentDisposition: `${disposition}; filename="${filename}"`,
    }),
    { expiresIn: 300 },
  )
}

// Kept under its original name — PDFs are just one of the stored types now.
export const createPresignedPdfDownload = createPresignedFileDownload

// Whether an uploaded key actually exists, and its size when the backend
// can tell cheaply. The save actions use this to reject a reference to an
// upload that never completed, or one over the size limit (presigned PUTs
// can't enforce a maximum size on their own).
export async function statStoredFile(
  key: string,
): Promise<{ found: boolean; size: number | null }> {
  const cfg = s3Config()
  if (cfg) {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3")
    const client = await s3Client(cfg)
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }))
      return { found: true, size: head.ContentLength ?? null }
    } catch {
      return { found: false, size: null }
    }
  }

  if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    const meta = await store.getMetadata(key)
    return { found: Boolean(meta), size: null }
  }

  try {
    const { stat } = await import("fs/promises")
    const info = await stat(path.join(LOCAL_DIR, key))
    return { found: true, size: info.size }
  } catch {
    return { found: false, size: null }
  }
}

// ---- Server-side saves and legacy storage ---------------------------------
// The legacy store (Netlify Blobs / local filesystem) is still used for:
// local dev, sites that haven't configured a bucket yet, and reading back
// any file that was stored before the S3 migration.

// Server-side save, for bytes that only exist on the server (a compiled
// LaTeX PDF, or an upload that came through the no-bucket fallback). Writes
// to the bucket when one is configured — reads go there too, so saving
// anywhere else would make the file unreachable — and to the legacy store
// otherwise.
export async function saveFileBlob(
  filename: string,
  data: Buffer,
  contentType: StoredContentType,
) {
  const key = pdfKeyFor(filename, contentType)
  const cfg = s3Config()

  if (cfg) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3")
    const client = await s3Client(cfg)
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    )
  } else if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    await store.set(key, new Blob([new Uint8Array(data)]), {
      metadata: { filename, contentType },
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

export async function savePdfBlob(filename: string, data: Buffer) {
  return saveFileBlob(filename, data, "application/pdf")
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
