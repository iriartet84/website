import type { Project } from '@/lib/content'

export function ProjectPreview({ kind }: { kind: Project['kind'] }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-700/40 via-navy to-navy" />
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
        {kind === 'map' && <MapPreview />}
        {kind === 'chart' && <ChartPreview />}
        {kind === 'dashboard' && <DashboardPreview />}
        {kind === 'model' && <ModelPreview />}
      </div>
    </div>
  )
}

function MapPreview() {
  return (
    <svg viewBox="0 0 400 200" className="size-full" preserveAspectRatio="xMidYMid slice">
      <g stroke="oklch(0.72 0.05 245)" strokeWidth="0.6" fill="none" opacity="0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 25} x2="400" y2={i * 25} />
        ))}
        {Array.from({ length: 17 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 25} y1="0" x2={i * 25} y2="200" />
        ))}
      </g>
      <path
        d="M40 120 Q140 60 220 100 T360 80"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        opacity="0.8"
        strokeDasharray="4 4"
      />
      <path
        d="M60 60 Q160 140 260 110 T380 140"
        stroke="oklch(0.72 0.05 245)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.8"
        strokeDasharray="4 4"
      />
      {[
        [40, 120],
        [220, 100],
        [360, 80],
        [60, 60],
        [260, 110],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4" fill="white">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

function ChartPreview() {
  const pts = [90, 70, 78, 55, 60, 40, 48, 30, 36, 20]
  return (
    <svg viewBox="0 0 400 200" className="size-full" preserveAspectRatio="none">
      <polyline
        points={pts.map((p, i) => `${(i / (pts.length - 1)) * 400},${p + 60}`).join(' ')}
        stroke="white"
        strokeWidth="2"
        fill="none"
      />
      <polyline
        points={`0,200 ${pts.map((p, i) => `${(i / (pts.length - 1)) * 400},${p + 60}`).join(' ')} 400,200`}
        fill="oklch(0.72 0.05 245 / 0.15)"
        stroke="none"
      />
      <line x1="0" y1="140" x2="400" y2="140" stroke="oklch(0.72 0.05 245)" strokeWidth="0.6" strokeDasharray="3 5" opacity="0.5" />
    </svg>
  )
}

function DashboardPreview() {
  const bars = [40, 70, 55, 85, 60, 95, 75]
  return (
    <svg viewBox="0 0 400 200" className="size-full" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={30 + i * 52}
          y={180 - h}
          width="30"
          height={h}
          rx="3"
          fill={i % 2 === 0 ? 'white' : 'oklch(0.72 0.05 245)'}
          opacity={0.85}
        />
      ))}
    </svg>
  )
}

function ModelPreview() {
  return (
    <svg viewBox="0 0 400 200" className="size-full" preserveAspectRatio="none">
      <path
        d="M0 150 C 80 150, 80 60, 160 60 S 240 140, 320 100 S 400 70, 400 70"
        stroke="white"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M0 160 C 80 160, 80 90, 160 90 S 240 150, 320 120 S 400 100, 400 100"
        stroke="oklch(0.72 0.05 245)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="5 4"
        opacity="0.8"
      />
      {[[160, 60], [320, 100], [400, 70]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" fill="white" />
      ))}
    </svg>
  )
}
