import { NextResponse } from "next/server"
import { readPdfBlob } from "@/lib/blobs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params
  const decoded = decodeURIComponent(key)
  if (decoded.includes("..") || decoded.includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data = await readPdfBlob(decoded)
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${decoded}"`,
      "cache-control": "public, max-age=3600",
    },
  })
}
