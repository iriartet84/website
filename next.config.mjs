// Origin the private bucket's presigned URLs point at (see lib/blobs.ts).
// /api/files/[key] answers with a redirect to such a URL, and CSP applies to
// the redirect target too — so the PDF viewer's <object> must be allowed to
// load from it (object-src, and frame-src: Chromium treats a PDF <object> as
// a frame), or the embedded PDF is blocked. Read at build
// time: on Netlify, S3_ENDPOINT must be available to builds, not only to
// functions (the default scope for site env vars covers both).
function storageOrigin() {
  const endpoint = process.env.S3_ENDPOINT
  if (endpoint) {
    try {
      return new URL(endpoint).origin
    } catch {
      return null
    }
  }
  // Plain AWS S3 (no custom endpoint) uses virtual-hosted-style URLs.
  const bucket = process.env.S3_BUCKET
  const region = process.env.S3_REGION
  if (bucket && region && region !== 'auto') {
    return `https://${bucket}.s3.${region}.amazonaws.com`
  }
  return null
}

const embedSources = ["'self'", storageOrigin()].filter(Boolean).join(' ')

// Origins of project apps that project pages may frame (the "Live app"
// section, components/project-embed.tsx), from PROJECT_EMBED_ORIGINS — a
// comma-separated list of https origins, e.g. "https://iriartet84.github.io".
// Same parsing as parseEmbedOrigins in lib/project-meta.ts. Read at build
// time, like S3_ENDPOINT above: adding an origin needs a redeploy.
function projectEmbedOrigins() {
  return (process.env.PROJECT_EMBED_ORIGINS ?? '')
    .split(/[\s,]+/)
    .map((item) => {
      try {
        const url = new URL(item)
        return url.protocol === 'https:' ? url.origin : null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

const frameSources = [embedSources, ...projectEmbedOrigins()].join(' ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Only matters when no S3-compatible bucket is configured (see
      // lib/blobs.ts) — with a bucket, the PDF bytes go straight from the
      // browser to storage via a presigned URL and never reach this limit.
      // Without one, this is the fallback path: the whole file transits a
      // Server Action, so it's sized with headroom over MAX_PDF_BYTES (8MB,
      // in lib/validations.ts) — Next's own default here is 1MB, which
      // would reject valid uploads before that check ever runs. Note this
      // fallback also passes through a Netlify Function in production,
      // whose ~4.5MB effective limit on binary payloads (base64 encoding
      // adds ~30% overhead on top of Netlify's 6MB buffered-payload cap) is
      // well under this number — configure a bucket to upload PDFs larger
      // than that.
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        // Excludes /api/files/* (below): PDFs served from there are
        // embedded same-origin via <object> in components/pdf-viewer.tsx,
        // and Firefox (unlike Chromium) refuses to render an <object>'s
        // content when the response itself carries X-Frame-Options: DENY
        // or frame-ancestors 'none' — it's not just an <iframe> rule there.
        source: "/((?!api/files).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              `object-src ${embedSources}`,
              `frame-src ${frameSources}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // The file-serving route: no X-Frame-Options: DENY here (see above),
        // but still not embeddable by an unrelated origin. Nothing stricter:
        // Chromium's PDF viewer loads the PDF as a plugin inside its own
        // response, so a restrictive default-src/object-src on the PDF
        // response itself can blank the viewer.
        source: "/api/files/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
