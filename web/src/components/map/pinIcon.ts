import { divIcon } from 'leaflet'

/** The app's pin colour (mobile/src/theme/colors.ts), so pins look the same on both. */
export const APP_PIN_COLOR = '#3e6fa8'

/** The teardrop pin as a Leaflet icon, shared by the map and the location picker. */
export function pinIcon(color: string, { scale = 1, className = '' }: { scale?: number; className?: string } = {}) {
  const w = Math.round(36 * scale)
  const h = Math.round(44 * scale)
  return divIcon({
    className,
    iconSize: [w, h],
    iconAnchor: [w / 2, Math.round(42 * scale)],
    tooltipAnchor: [0, -h + 6],
    html: `<svg width="${w}" height="${h}" viewBox="-18 -32 36 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 10 C -10 -2, -14 -9, -14 -16 A 14 14 0 1 1 14 -16 C 14 -9, 10 -2, 0 10 Z"
        fill="${color}" stroke="#fff" stroke-width="2.5"/>
      <circle cy="-16" r="5" fill="#fff"/></svg>`,
  })
}
