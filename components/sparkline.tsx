import { cn } from '@/lib/utils'

// A tiny trend line for cards and the Home preview. Decorative: the
// headline figure next to it carries the information, so it's hidden from
// screen readers.
export function Sparkline({
  values,
  className,
  stroke = 'white',
}: {
  values: number[]
  className?: string
  stroke?: string
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 100
  const height = 32
  const points = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - 2 - ((value - min) / span) * (height - 4)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  // preserveAspectRatio="none" lets the line fill any box; the stroke keeps
  // its width via non-scaling-stroke.
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
