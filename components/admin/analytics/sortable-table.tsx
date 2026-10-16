'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// A compact ranked list with sortable columns. Rows can link somewhere —
// on the dashboard, to the same view filtered by that row. Cells arrive
// pre-formatted from the server, with a raw value to sort by.

export type Cell = { display: string; sort: number | string; hint?: string }
export type Column = { key: string; label: string; numeric?: boolean; bar?: boolean }
export type Row = { id: string; href?: string; active?: boolean; cells: Record<string, Cell> }

export function SortableTable({
  columns,
  rows,
  initialSort,
  empty = 'Nothing recorded yet.',
  limit = 10,
  caption,
}: {
  columns: Column[]
  rows: Row[]
  initialSort?: string
  empty?: string
  limit?: number
  caption?: string
}) {
  const [sortKey, setSortKey] = useState(initialSort ?? columns.find((c) => c.numeric)?.key ?? columns[0].key)
  const [desc, setDesc] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const x = a.cells[sortKey]?.sort ?? 0
      const y = b.cells[sortKey]?.sort ?? 0
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return desc ? -cmp : cmp
    })
    return copy
  }, [rows, sortKey, desc])

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>

  const visible = expanded ? sorted : sorted.slice(0, limit)
  const barColumn = columns.find((c) => c.bar)
  const barMax = barColumn ? Math.max(1, ...rows.map((r) => Number(r.cells[barColumn.key]?.sort ?? 0))) : 1

  return (
    <div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {columns.map((column) => {
              const active = column.key === sortKey
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
                  className={cn('pb-2 align-bottom font-medium', column.numeric && 'whitespace-nowrap pl-3 text-right')}
                >
                  <button
                    type="button"
                    className={cn('inline-flex items-center gap-1 hover:text-navy', active && 'text-navy')}
                    onClick={() => {
                      if (active) setDesc((d) => !d)
                      else {
                        setSortKey(column.key)
                        setDesc(Boolean(column.numeric))
                      }
                    }}
                  >
                    {column.label}
                    {active && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.id} className={cn('border-t border-border/70', row.active && 'bg-steel/5')}>
              {columns.map((column, ci) => {
                const cell = row.cells[column.key]
                const content =
                  ci === 0 && row.href ? (
                    <Link href={row.href} className="hover:text-steel-700 hover:underline" title={cell?.hint ?? 'Filter by this'}>
                      {cell?.display}
                    </Link>
                  ) : (
                    <span title={cell?.hint}>{cell?.display}</span>
                  )
                return (
                  <td
                    key={column.key}
                    className={cn(
                      'relative py-1.5 align-top',
                      column.numeric ? 'pl-3 text-right tabular-nums' : 'pr-3',
                      ci === 0 && 'max-w-0 w-full truncate',
                    )}
                  >
                    {ci === 0 && barColumn && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-0 -z-0 rounded bg-steel/10"
                        style={{ width: `${(Number(row.cells[barColumn.key]?.sort ?? 0) / barMax) * 100}%` }}
                      />
                    )}
                    <span className={cn('relative', ci === 0 && 'pl-1.5')}>{content}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-steel-700 hover:text-navy"
        >
          {expanded ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}
