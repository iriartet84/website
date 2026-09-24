import { NextResponse } from "next/server"
import {
  contentTypeForKey,
  createPresignedFileDownload,
  readPdfBlob,
} from "@/lib/blobs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params
  const decoded = decodeURIComponent(key)
  if (decoded.includes("..") || decoded.includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const download = searchParams.get("download") === "1"
  const filename = (searchParams.get("filename") || decoded).replace(/["\\\r\n]/g, "")

  // When files are stored in the S3-compatible bucket (see lib/blobs.ts),
  // redirect to a short-lived presigned URL instead of proxying the bytes
  // through this Netlify Function — binary responses over a Function are
  // capped well under the size these PDFs can reach (see the comment on
  // bodySizeLimit in next.config.mjs). The redirect itself must never be
  // cached: the presigned URL it points to expires long before this
  // route's own response would.
  const presignedUrl = await createPresignedFileDownload(decoded, { filename, download })
  if (presignedUrl) {
    return NextResponse.redirect(presignedUrl, {
      status: 302,
      headers: { "cache-control": "no-store" },
    })
  }

  // Fallback — used only for files uploaded before a bucket was configured.
  const data = await readPdfBlob(decoded)
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": contentTypeForKey(decoded),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "cache-control": "public, max-age=3600",
    },
  })
}
