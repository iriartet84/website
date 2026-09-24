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
              "object-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // The PDF-serving route: no X-Frame-Options/frame-ancestors here
        // (see above), but still locked down against being loaded from an
        // unrelated origin's <object>/<embed>.
        source: "/api/files/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; object-src 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
