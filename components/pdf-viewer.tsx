export function PdfViewer({
  url,
  title,
  filename,
}: {
  url: string
  title: string
  filename?: string | null
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm shadow-navy/5">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <span className="text-sm font-medium text-navy">Document</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-steel-700 transition-colors hover:text-navy"
        >
          Open original
        </a>
      </figcaption>
      <object
        data={url}
        type="application/pdf"
        className="h-[80vh] w-full bg-secondary"
        aria-label={`PDF document for ${title}`}
      >
        <div className="flex h-64 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your browser can&apos;t display this PDF inline.
          </p>
          <a
            href={url}
            download={filename ?? undefined}
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy-800"
          >
            Download the PDF
          </a>
        </div>
      </object>
    </figure>
  )
}
