import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import { useTheme } from '@mui/material/styles'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { APP_PIN_COLOR, pinIcon } from '../map/pinIcon'
import { searchPlace } from '../../utils/geocode'

export type LatLng = [number, number]

function ClickToPlace({ onPlace }: { onPlace: (to: LatLng) => void }) {
  useMapEvents({ click: (e) => onPlace([e.latlng.lat, e.latlng.lng]) })
  return null
}

/** Moves the map when a search result is chosen. */
function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [map, target])
  return null
}

interface LocationPickerProps {
  value: LatLng
  onChange: (to: LatLng) => void
}

/** Click, drag or search to put the event's pin where residents will see it in the app. */
export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null)
  const pin = useMemo(() => pinIcon(APP_PIN_COLOR, { scale: 0.8 }), [])
  // The map opens where the pin started; later moves come from clicks, drags or search
  const [start] = useState(value)

  async function search() {
    if (!query.trim() || searching) return
    setSearching(true)
    setMessage(null)
    try {
      const target = await searchPlace(query)
      if (!target) {
        setMessage('No match in Southampton. Try a street name or postcode, or click the map.')
        return
      }
      onChange(target)
      setFlyTarget(target)
    } catch {
      setMessage('Search is unavailable right now. Click the map to place the pin instead.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <Stack spacing={1}>
      {/* Not a nested <form>: Enter searches instead of submitting the event */}
      <TextField
        size="small"
        placeholder="Search for a street, place or postcode"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void search()
          }
        }}
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'Search for a place' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searching ? (
              <CircularProgress size={18} />
            ) : (
              <IconButton edge="end" aria-label="Search" size="small" onClick={() => void search()}>
                <SearchRounded fontSize="small" />
              </IconButton>
            ),
          },
        }}
      />
      <Box
        sx={{
          height: 280,
          borderRadius: 2,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          '& .leaflet-container': { height: '100%', fontFamily: theme.typography.fontFamily, cursor: 'crosshair' },
          '& .leaflet-tile-pane': {
            filter: dark ? 'grayscale(1) invert(1) brightness(0.9) contrast(0.9)' : 'grayscale(1) brightness(1.04)',
          },
        }}
      >
        <MapContainer center={start} zoom={15} maxZoom={19} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <ClickToPlace onPlace={onChange} />
          <FlyTo target={flyTarget} />
          <Marker
            position={value}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onChange([lat, lng])
              },
            }}
          />
        </MapContainer>
      </Box>
      <Typography variant="caption" color={message ? 'warning.main' : 'text.secondary'}>
        {message ?? `Click the map or drag the pin. ${value[0].toFixed(5)}, ${value[1].toFixed(5)}`}
      </Typography>
    </Stack>
  )
}
