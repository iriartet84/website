'use client'

import { requestUploadUrlAction, uploadFileFallbackAction, type UploadKind } from '@/app/admin/upload-actions'
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '@/lib/validations'

// Client side of the file uploads used by the page editors. Same flow as
// before for PDFs, now also used for images: ask the server for a presigned
// URL, then PUT the file straight to the private bucket — the bytes never
// pass through a Netlify Function. When no bucket is configured the server
// returns no URL and the file goes through the fallback action instead.

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function validateFile(file: File, kind: UploadKind): string | null {
  if (kind === 'pdf') {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are accepted.'
    }
    if (file.size > MAX_PDF_BYTES) {
      return `PDF files must be ${Math.round(MAX_PDF_BYTES / (1024 * 1024))}MB or smaller.`
    }
    return null
  }
  if (!IMAGE_TYPES.includes(file.type)) return 'Images must be PNG, JPEG, WebP or GIF.'
  if (file.size > MAX_IMAGE_BYTES) {
    return `Images must be ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`
  }
  return null
}

export async function uploadFile(file: File, kind: UploadKind): Promise<{ key: string }> {
  const problem = validateFile(file, kind)
  if (problem) throw new Error(problem)

  const contentType = kind === 'pdf' ? 'application/pdf' : file.type
  const prepared = await requestUploadUrlAction(file.name, kind, contentType)
  if (!prepared.ok) throw new Error(prepared.error)

  if (prepared.presigned) {
    let response: Response
    try {
      response = await fetch(prepared.presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
    } catch {
      throw new Error(
        `Couldn't reach file storage to upload “${file.name}”. Check your connection, and that the bucket's CORS rules allow this site's address.`,
      )
    }
    if (!response.ok) {
      throw new Error(`Uploading “${file.name}” to storage failed (HTTP ${response.status}).`)
    }
    return { key: prepared.presigned.key }
  }

  const formData = new FormData()
  formData.set('kind', kind)
  formData.set('file', file)
  const stored = await uploadFileFallbackAction(formData)
  if (!stored.ok) throw new Error(stored.error)
  return { key: stored.key }
}

export function fileUrl(key: string, options?: { download?: boolean; filename?: string }) {
  const params = new URLSearchParams()
  if (options?.download) params.set('download', '1')
  if (options?.filename) params.set('filename', options.filename)
  const query = params.toString()
  return `/api/files/${encodeURIComponent(key)}${query ? `?${query}` : ''}`
}
