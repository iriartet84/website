import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

const STORE_NAME = "portfolio-files"
const LOCAL_DIR = path.join(process.cwd(), ".data", "blobs")

function isNetlify() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT)
}

export async function savePdfBlob(filename: string, data: Buffer) {
  const key = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`

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

export async function deletePdfBlob(key: string) {
  if (isNetlify()) {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore(STORE_NAME)
    await store.delete(key)
    return
  }

  const { unlink } = await import("fs/promises")
  await unlink(path.join(LOCAL_DIR, key)).catch(() => undefined)
}
