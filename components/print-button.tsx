'use client'

import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

// "Save as PDF" for a LaTeX article without an attached PDF: the browser's
// print dialog, with the print styles in app/globals.css leaving just the
// paper on the page.
export function PrintButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={cn(className)}>
      <Printer aria-hidden className="size-4" />
      {children ?? 'Save as PDF'}
    </button>
  )
}
