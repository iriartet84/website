"use server"

import { requireAdmin } from "@/lib/require-admin"
import {
  IMAGE_CONTENT_TYPES,
  createPresignedFileUpload,
  saveFileBlob,
  type StoredContentType,
} from "@/lib/blobs"
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "@/lib/validations"
import { errorMessage } from "@/lib/action-error"

// Upload endpoints for the page editors (components/admin/upload.ts is the
// client side). Same architecture as the paper/CV PDF uploads before them:
// with a bucket configured, the browser gets a presigned PUT URL and sends
// the bytes straight to storage; without one, the file comes through
// uploadFileFallbackAction instead. Nothing is written to the database
// here — the editors reference the returned key when the page is saved.

export type UploadKind = "pdf" | "image"

type Failure = { ok: false; error: string }

const SIGNED_OUT = "Your session has ended. Sign in again, then retry the upload."

function contentTypeFor(kind: UploadKind, declared: string): StoredContentType | null {
  if (kind === "pdf") return "application/pdf"
  return declared in IMAGE_CONTENT_TYPES ? (declared as StoredContentType) : null
}

function maxBytesFor(kind: UploadKind) {
  return kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
}

export async function requestUploadUrlAction(
  filename: string,
  kind: UploadKind,
  declaredContentType: string,
): Promise<{ ok: true; presigned: { key: string; uploadUrl: string } | null } | Failure> {
  const session = await requireAdmin()
  if (!session) return { ok: false, error: SIGNED_OUT }

  const contentType = contentTypeFor(kind, declaredContentType)
  if (!contentType) {
    return { ok: false, error: "Images must be PNG, JPEG, WebP or GIF." }
  }

  try {
    const presigned = await createPresignedFileUpload(filename, contentType)
    return { ok: true, presigned }
  } catch (error) {
    return { ok: false, error: `Couldn't prepare the upload: ${errorMessage(error)}` }
  }
}

// Fallback path, used only when no bucket is configured (see lib/blobs.ts).
export async function uploadFileFallbackAction(
  formData: FormData,
): Promise<{ ok: true; key: string } | Failure> {
  const session = await requireAdmin()
  if (!session) return { ok: false, error: SIGNED_OUT }

  const kind = formData.get("kind") === "image" ? "image" : "pdf"
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file was received." }
  }

  const contentType = contentTypeFor(kind, file.type)
  if (!contentType) {
    return { ok: false, error: "Images must be PNG, JPEG, WebP or GIF." }
  }
  if (kind === "pdf" && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Only PDF files are accepted." }
  }
  if (file.size > maxBytesFor(kind)) {
    return {
      ok: false,
      error: `${kind === "pdf" ? "PDF" : "Image"} files must be ${Math.round(maxBytesFor(kind) / (1024 * 1024))}MB or smaller.`,
    }
  }

  try {
    const stored = await saveFileBlob(file.name, Buffer.from(await file.arrayBuffer()), contentType)
    return { ok: true, key: stored.key }
  } catch (error) {
    return { ok: false, error: `Upload failed: ${errorMessage(error)}` }
  }
}
