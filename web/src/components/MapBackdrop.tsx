import { useTheme, alpha } from '@mui/material/styles'
import { brandBlue } from '../theme'

/**
 * Decorative, abstract map motif: street grid, a waterline, and a few
 * proposal pins. Purely visual — hidden from assistive tech.
 */
export default function MapBackdrop() {
  const theme = useTheme()
  const line = alpha('#FFFFFF', 0.14)
  const road = alpha('#FFFFFF', 0.28)
  const water = alpha('#FFFFFF', 0.08)

  const pins = [
    { x: 182, y: 248, r: 1 },
    { x: 338, y: 166, r: 0.8 },
    { x: 418, y: 342, r: 1.1 },
    { x: 262, y: 432, r: 0.85 },
  ]

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 700"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {/* fine grid */}
      {Array.from({ length: 16 }, (_, i) => (
        <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={700} stroke={line} strokeWidth={1} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 40} x2={600} y2={i * 40} stroke={line} strokeWidth={1} />
      ))}

      {/* estuary */}
      <path
        d="M0 560 C 120 520, 200 600, 320 570 S 520 500, 600 540 L600 700 L0 700 Z"
        fill={water}
      />
      <path
        d="M0 560 C 120 520, 200 600, 320 570 S 520 500, 600 540"
        fill="none"
        stroke={road}
        strokeWidth={1.5}
      />

      {/* main roads */}
      <path d="M-20 120 C 140 160, 260 90, 620 210" fill="none" stroke={road} strokeWidth={3} strokeLinecap="round" />
      <path d="M90 -20 C 120 200, 240 330, 210 720" fill="none" stroke={road} strokeWidth={3} strokeLinecap="round" />
      <path d="M380 -20 C 360 180, 470 300, 440 560" fill="none" stroke={road} strokeWidth={2} strokeLinecap="round" />
      <path d="M-20 380 C 160 360, 320 420, 620 340" fill="none" stroke={road} strokeWidth={2} strokeLinecap="round" />

      {/* proposal pins */}
      {pins.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.r})`}>
          <circle r={26} fill={alpha('#FFFFFF', 0.1)} />
          <path
            d="M0 10 C -10 -2, -12 -8, -12 -14 A 12 12 0 1 1 12 -14 C 12 -8, 10 -2, 0 10 Z"
            fill="#FFFFFF"
          />
          <circle cy={-14} r={4.5} fill={brandBlue(theme)} />
        </g>
      ))}
    </svg>
  )
}
