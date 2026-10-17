import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { latLngBounds, type LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import { useTheme, keyframes } from '@mui/material/styles'
import type { AdminEvent } from '../../api/events'
import type { LatLng } from '../events/LocationPicker'
import { APP_PIN_COLOR, pinIcon } from './pinIcon'

// Same starting view as the phone app
const SOUTHAMPTON: LatLngExpression = [50.9097, -1.4044]
const START_ZOOM = 13
const FOCUS_ZOOM = 16

export type MapCommand =
  | { kind: 'fit' } // frame every event
  | { kind: 'home' } // back to the city view
  | { kind: 'fly'; to: [number, number] } // e.g. a place search result
  | null

const pulse = keyframes`
  0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
  50% { transform: scale(1.25); filter: drop-shadow(0 4px 8px rgba(0,0,0,.35)); }
  100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
`

const toLatLng = (e: AdminEvent): LatLng => [e.latitude, e.longitude]

function Commands({ events, command, commandId }: { events: AdminEvent[]; command: MapCommand; commandId: number }) {
  const map = useMap()
  const fitted = useRef(false)
  // Commands read the latest events without re-running when events change
  const latest = useRef(events)
  useEffect(() => {
    latest.current = events
  }, [events])

  // Like the phone: frame the events once, then leave the view to the admin
  useEffect(() => {
    if (fitted.current || !events.length) return
    fitted.current = true
    map.fitBounds(latLngBounds(events.map(toLatLng)), {
      padding: [48, 48],
      maxZoom: START_ZOOM,
      animate: false,
    })
  }, [map, events])

  useEffect(() => {
    if (!command) return
    if (command.kind === 'home') map.flyTo(SOUTHAMPTON, START_ZOOM, { duration: 0.6 })
    if (command.kind === 'fly') map.flyTo(command.to, Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 })
    if (command.kind === 'fit' && latest.current.length)
      map.flyToBounds(latLngBounds(latest.current.map(toLatLng)), {
        padding: [48, 48],
        maxZoom: FOCUS_ZOOM,
        duration: 0.6,
      })
    // commandId re-runs repeated commands (pressing "Show all" twice)
  }, [map, command, commandId])

  return null
}

function FocusSelected({ event }: { event: AdminEvent | undefined }) {
  const map = useMap()
  // Like the phone: fly to a pin when it's chosen (or if it moves), not on every refresh
  const id = event?.id
  const lat = event?.latitude
  const lng = event?.longitude
  useEffect(() => {
    if (id === undefined || lat === undefined || lng === undefined) return
    if (!map.getBounds().pad(-0.2).contains([lat, lng]) || map.getZoom() < FOCUS_ZOOM)
      map.flyTo([lat, lng], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.65 })
  }, [map, id, lat, lng])
  return null
}

/** Leaflet measures its box once; re-measure when the page layout changes it. */
function KeepSized() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

/** Keeps `centerRef` on the middle of the view, e.g. to start a new event's pin there. */
function CenterWatcher({ centerRef }: { centerRef: RefObject<LatLng> }) {
  const map = useMapEvents({
    moveend: () => {
      const { lat, lng } = map.getCenter()
      centerRef.current = [lat, lng]
    },
  })
  return null
}

interface LiveMapProps {
  events: AdminEvent[]
  selectedId: number | null
  freshIds: ReadonlySet<number>
  onSelect: (id: number) => void
  command: MapCommand
  commandId: number
  centerRef: RefObject<LatLng>
}

export default function LiveMap({ events, selectedId, freshIds, onSelect, command, commandId, centerRef }: LiveMapProps) {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const selected = events.find((e) => e.id === selectedId)

  // One colour for every pin, as in the app
  const icons = useMemo(
    () => ({
      normal: pinIcon(APP_PIN_COLOR, { scale: 0.8 }),
      selected: pinIcon(APP_PIN_COLOR, { scale: 1.05, className: 'pin-selected' }),
      fresh: pinIcon(APP_PIN_COLOR, { scale: 0.8, className: 'pin-fresh' }),
    }),
    [],
  )

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        '& .leaflet-container': {
          height: '100%',
          fontFamily: theme.typography.fontFamily,
          bgcolor: dark ? '#1b2026' : '#f2f3f5',
        },
        // Greyscale streets like the phone app, so the pins stand out
        '& .leaflet-tile-pane': {
          filter: dark ? 'grayscale(1) invert(1) brightness(0.9) contrast(0.9)' : 'grayscale(1) brightness(1.04)',
        },
        '& .leaflet-marker-icon': { transition: 'filter 150ms' },
        '& .leaflet-marker-icon:focus-visible': { outline: `3px solid ${theme.palette.primary.main}`, borderRadius: 1 },
        '& .pin-selected': { filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.35))' },
        '& .pin-fresh svg': { animation: `${pulse} 1.2s ease-in-out 6`, transformOrigin: '50% 100%' },
        '& .leaflet-control-zoom a': {
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderColor: 'divider',
        },
        '& .leaflet-control-attribution': {
          bgcolor: dark ? 'rgba(22,28,36,.85)' : 'rgba(255,255,255,.85)',
          color: 'text.secondary',
          '& a': { color: 'primary.main' },
        },
        '@media (prefers-reduced-motion: reduce)': { '& .pin-fresh svg': { animation: 'none' } },
      }}
    >
      <MapContainer center={SOUTHAMPTON} zoom={START_ZOOM} maxZoom={19} zoomControl={false} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        <Commands events={events} command={command} commandId={commandId} />
        <FocusSelected event={selected} />
        <KeepSized />
        <CenterWatcher centerRef={centerRef} />

        {events.map((e) => {
          const isSelected = e.id === selectedId
          return (
            <Marker
              key={e.id}
              position={toLatLng(e)}
              icon={isSelected ? icons.selected : freshIds.has(e.id) ? icons.fresh : icons.normal}
              title={e.title}
              alt={e.title}
              zIndexOffset={isSelected ? 1000 : freshIds.has(e.id) ? 500 : 0}
              eventHandlers={{ click: () => onSelect(e.id) }}
            >
              {!isSelected && (
                <Tooltip direction="top" opacity={1}>
                  {e.title}
                </Tooltip>
              )}
            </Marker>
          )
        })}
      </MapContainer>
    </Box>
  )
}
