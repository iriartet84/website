'use client'

import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'

// A project's deployed app (Shiny, Dash, Streamlit, Observable, a static
// JS app on GitHub Pages...), framed on its project page. Loaded only on
// click: the page stays fast, and visitors choose to run third-party code.
// The frame is sandboxed and keeps the app's own origin, so it can't reach
// this site's cookies or pages. Its origin must also be listed in
// PROJECT_EMBED_ORIGINS, which next.config.mjs adds to the CSP frame-src.
export function ProjectEmbed({ url, title, height }: { url: string; title: string; height: number }) {
  const [loaded, setLoaded] = useState(false)
  let host = url
  try {
    host = new URL(url).host
  } catch {}

  if (!loaded) {
    return (
      <div
        className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-navy px-6 text-center"
        style={{ height: Math.min(height, 420) }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-navy-700/50 via-navy to-navy" />
        <div className="relative">
          <p className="font-serif text-2xl text-white">{title}</p>
          <p className="mt-2 text-sm text-white/70">Interactive app hosted at {host}</p>
        </div>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setLoaded(true)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-secondary"
          >
            <Play className="size-4 fill-current" />
            Load the app
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Open in a new tab <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div>
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
        allow="fullscreen; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
        className="w-full rounded-2xl border border-border bg-white"
        style={{ height }}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-steel-700 hover:underline"
      >
        Open the app in a new tab <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
