'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs'

// The PDF reader on paper and project pages. Pages are drawn by pdf.js
// (with a selectable text layer), so it looks and behaves the same in every
// browser, phones included, with the site's own toolbar: page x of y, zoom,
// fit to width, download, open, full screen. Pages are drawn only as they
// come into view. If the PDF can't be loaded here, it falls back to links.

// pdf.js's "legacy" build: the same library with polyfills for the APIs its
// default build expects from the very newest browsers (Safari and older
// Chrome/Firefox versions lack some of them).
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfjsPromise: Promise<PdfJs> | null = null
function loadPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' },
      )
    }
    return pdfjs
  })
  return pdfjsPromise
}

// pdf.js scale 1 = 1 CSS pixel per PDF point; "100%" is the printed size.
const CSS_UNITS = 96 / 72
const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const PAGE_GAP = 16

type Size = { width: number; height: number }

export function PdfViewer({
  url,
  filename,
  title,
  className,
}: {
  url: string
  filename?: string | null
  title: string
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const pdfjsRef = useRef<PdfJs | null>(null)
  const renderedScale = useRef<Map<number, number>>(new Map())
  const tasks = useRef<Map<number, RenderTask>>(new Map())

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sizes, setSizes] = useState<Size[]>([])
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [fitZoom, setFitZoom] = useState(1)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [fullscreen, setFullscreen] = useState(false)

  const effectiveZoom = zoom === 'fit' ? fitZoom : zoom
  const scale = effectiveZoom * CSS_UNITS
  const downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=1${filename ? `&filename=${encodeURIComponent(filename)}` : ''}`

  // Load the document and every page's size (for the placeholders).
  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<PdfJs['getDocument']> | null = null
    setStatus('loading')
    loadPdfJs()
      .then(async (pdfjs) => {
        pdfjsRef.current = pdfjs
        loadingTask = pdfjs.getDocument({ url, enableXfa: false })
        const doc = await loadingTask.promise
        if (cancelled) return
        const pageSizes: Size[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const pdfPage = await doc.getPage(n)
          const viewport = pdfPage.getViewport({ scale: 1 })
          pageSizes.push({ width: viewport.width, height: viewport.height })
        }
        if (cancelled) return
        docRef.current = doc
        renderedScale.current.clear()
        setSizes(pageSizes)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      tasks.current.forEach((task) => task.cancel())
      tasks.current.clear()
      loadingTask?.destroy()
      docRef.current = null
    }
  }, [url])

  // "Fit width": follow the reader's width.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || sizes.length === 0) return
    const widest = Math.max(...sizes.map((size) => size.width))
    const update = () => {
      const available = scroller.clientWidth - 2 * PAGE_GAP
      setFitZoom(Math.max(0.3, Math.min(3, available / (widest * CSS_UNITS))))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [sizes])

  const renderPage = useCallback(
    async (index: number) => {
      const doc = docRef.current
      const pdfjs = pdfjsRef.current
      const holder = pageRefs.current[index]
      if (!doc || !pdfjs || !holder) return
      if (renderedScale.current.get(index) === scale) return
      renderedScale.current.set(index, scale)
      tasks.current.get(index)?.cancel()

      let pdfPage: PDFPageProxy
      try {
        pdfPage = await doc.getPage(index + 1)
      } catch {
        return
      }
      const viewport = pdfPage.getViewport({ scale })
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5)
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      // Stretches with its page while a new zoom level is being drawn.
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.className = 'block'
      const task = pdfPage.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      })
      tasks.current.set(index, task)
      try {
        await task.promise
      } catch {
        return // cancelled (zoom changed, or the reader went away)
      }
      if (renderedScale.current.get(index) !== scale) return

      const textLayer = document.createElement('div')
      textLayer.className = 'textLayer'
      textLayer.style.setProperty('--scale-factor', String(scale))
      textLayer.style.setProperty('--total-scale-factor', String(scale))
      holder.replaceChildren(canvas, textLayer)
      try {
        await new pdfjs.TextLayer({ textContentSource: pdfPage.streamTextContent(), container: textLayer, viewport }).render()
      } catch {
        // The page still shows; its text just isn't selectable.
      }
    },
    [scale],
  )

  // Draw pages as they come near the viewport; redraw on zoom.
  useEffect(() => {
    const scroller = scrollRef.current
    if (status !== 'ready' || !scroller) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void renderPage(Number((entry.target as HTMLElement).dataset.index))
        }
      },
      { root: scroller, rootMargin: '600px 0px' },
    )
    pageRefs.current.forEach((holder) => holder && observer.observe(holder))
    return () => observer.disconnect()
  }, [status, renderPage, sizes])

  // The page at the top of the reader.
  useEffect(() => {
    const scroller = scrollRef.current
    if (status !== 'ready' || !scroller) return
    const onScroll = () => {
      const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.3
      let current = 1
      pageRefs.current.forEach((holder, index) => {
        if (holder && holder.getBoundingClientRect().top <= top) current = index + 1
      })
      setPage(current)
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [status, scale])

  useEffect(() => setPageInput(String(page)), [page])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const goTo = (target: number) => {
    const index = Math.max(1, Math.min(sizes.length, target)) - 1
    const holder = pageRefs.current[index]
    const scroller = scrollRef.current
    if (!holder || !scroller) return
    scroller.scrollTo({ top: holder.offsetTop - PAGE_GAP, behavior: 'smooth' })
  }

  const stepZoom = (direction: 1 | -1) => {
    const current = effectiveZoom
    const next =
      direction > 0
        ? ZOOM_STEPS.find((step) => step > current + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
        : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01) ?? ZOOM_STEPS[0]
    setZoom(next)
  }

  const toggleFullscreen = () => {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.requestFullscreen?.()
  }

  const toolButton =
    'inline-flex size-8 items-center justify-center rounded-full text-navy transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-35'

  return (
    <figure
      ref={frameRef}
      className={cn(
        'pdf-reader flex flex-col overflow-hidden border border-border bg-white shadow-sm shadow-navy/5',
        fullscreen ? 'h-screen rounded-none' : 'h-[85vh] min-h-[28rem] rounded-2xl',
        className,
      )}
      aria-label={`PDF: ${title}`}
    >
      <figcaption className="flex items-center gap-2 border-b border-border bg-white px-3 py-2 sm:px-4">
        <span className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          <FileText aria-hidden className="size-4 shrink-0 text-steel" />
          <span className="truncate text-sm font-medium text-navy" title={filename ?? title}>
            {filename ?? title}
          </span>
        </span>

        <span className="flex items-center gap-0.5 sm:flex-none">
          <button type="button" className={toolButton} aria-label="Previous page" disabled={status !== 'ready' || page <= 1} onClick={() => goTo(page - 1)}>
            <ChevronLeft className="size-4" />
          </button>
          <form
            className="flex items-center gap-1 text-sm text-muted-foreground"
            onSubmit={(event) => {
              event.preventDefault()
              const target = Number.parseInt(pageInput, 10)
              if (Number.isFinite(target)) goTo(target)
            }}
          >
            <input
              aria-label="Page number"
              inputMode="numeric"
              value={status === 'ready' ? pageInput : '–'}
              disabled={status !== 'ready'}
              onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => setPageInput(String(page))}
              className="h-7 w-10 rounded-md border border-border bg-white text-center text-sm tabular-nums text-navy outline-none focus:border-steel focus:ring-2 focus:ring-steel/20"
            />
            <span className="tabular-nums">/ {status === 'ready' ? sizes.length : '–'}</span>
          </form>
          <button type="button" className={toolButton} aria-label="Next page" disabled={status !== 'ready' || page >= sizes.length} onClick={() => goTo(page + 1)}>
            <ChevronRight className="size-4" />
          </button>
        </span>

        <span className="mx-1 hidden h-5 w-px bg-border md:block" />

        <span className="ml-auto flex items-center gap-0.5 sm:ml-0">
          <button type="button" className={toolButton} aria-label="Zoom out" disabled={status !== 'ready'} onClick={() => stepZoom(-1)}>
            <ZoomOut className="size-4" />
          </button>
          <span className="hidden w-12 text-center text-xs tabular-nums text-muted-foreground sm:inline">
            {Math.round(effectiveZoom * 100)}%
          </span>
          <button type="button" className={toolButton} aria-label="Zoom in" disabled={status !== 'ready'} onClick={() => stepZoom(1)}>
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            className={cn(toolButton, zoom === 'fit' && 'bg-steel/15 text-navy')}
            aria-label="Fit to width"
            aria-pressed={zoom === 'fit'}
            title="Fit to width"
            disabled={status !== 'ready'}
            onClick={() => setZoom('fit')}
          >
            <MoveHorizontal className="size-4" />
          </button>
        </span>

        <span className="mx-1 hidden h-5 w-px bg-border md:block" />

        <span className="flex items-center gap-0.5">
          <a href={downloadUrl} className={toolButton} aria-label="Download PDF" title="Download PDF">
            <Download className="size-4" />
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer" className={cn(toolButton, 'hidden sm:inline-flex')} aria-label="Open in a new tab" title="Open in a new tab">
            <ExternalLink className="size-4" />
          </a>
          <button type="button" className={cn(toolButton, 'hidden sm:inline-flex')} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </span>
      </figcaption>

      <div ref={scrollRef} className="relative flex-1 overflow-auto bg-[oklch(0.95_0.008_258)]" tabIndex={0} aria-label="Pages">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 p-4" aria-busy="true" aria-label="Loading the PDF">
            {[0, 1].map((n) => (
              <div key={n} className="aspect-[1/1.35] w-full max-w-2xl animate-pulse rounded-sm bg-white shadow-sm" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <FileText aria-hidden className="size-8 text-steel" />
            <p className="max-w-sm text-sm text-muted-foreground">The PDF couldn&rsquo;t be displayed here.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-secondary">
                <ExternalLink className="size-4" /> Open the PDF
              </a>
              <a href={downloadUrl} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
                <Download className="size-4" /> Download
              </a>
            </div>
          </div>
        )}

        {status === 'ready' && (
          <div className="flex min-w-fit flex-col items-center" style={{ gap: PAGE_GAP, padding: PAGE_GAP }}>
            {sizes.map((size, index) => (
              <div
                key={index}
                ref={(node) => {
                  pageRefs.current[index] = node
                }}
                data-index={index}
                aria-label={`Page ${index + 1}`}
                className="relative shrink-0 bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12),0_8px_24px_-12px_rgb(15_23_42/0.25)]"
                style={{ width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) }}
              />
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
