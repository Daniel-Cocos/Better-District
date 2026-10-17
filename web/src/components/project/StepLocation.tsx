import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon, type LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { useTheme } from '@mui/material/styles'
import SearchRounded from '@mui/icons-material/SearchRounded'
import TouchAppOutlined from '@mui/icons-material/TouchAppOutlined'
import { stageMeta } from '../postMeta'
import FieldGroup from './FieldGroup'
import type { StepProps } from './StepBasics'

const SOUTHAMPTON: LatLngExpression = [50.9097, -1.4044]
// Keeps place search inside the city (west, north, east, south)
const VIEWBOX = '-1.48,50.96,-1.33,50.87'

const formatRadius = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} km` : `${m} m`)

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPlace(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Moves the map when a search result is chosen. */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [map, target])
  return null
}

export default function StepLocation({ form, update, errors }: StepProps) {
  const theme = useTheme()
  const color = stageMeta[form.stage].color
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const loc = form.location
  const radius = loc?.radius_m ?? 250

  const pin = useMemo(
    () =>
      divIcon({
        className: '',
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        html: `<svg width="36" height="44" viewBox="-18 -32 36 44" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 10 C -10 -2, -14 -9, -14 -16 A 14 14 0 1 1 14 -16 C 14 -9, 10 -2, 0 10 Z"
            fill="${color}" stroke="#fff" stroke-width="2.5"/>
          <circle cy="-16" r="5" fill="#fff"/></svg>`,
      }),
    [color],
  )

  const place = (latitude: number, longitude: number) =>
    update({ location: { latitude, longitude, radius_m: radius } })

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      // OpenStreetMap's free geocoder: one request per search, never per keystroke
      const params = new URLSearchParams({ q: query, format: 'json', limit: '1', viewbox: VIEWBOX, bounded: '1' })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      const [hit] = (await res.json()) as { lat: string; lon: string }[]
      if (!hit) {
        setSearchError('No match in Southampton. Try a street name or postcode, or click the map.')
        return
      }
      const target: [number, number] = [Number(hit.lat), Number(hit.lon)]
      place(...target)
      setFlyTarget(target)
    } catch {
      setSearchError('Search is unavailable right now. Click the map to place the pin instead.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Box component="form" onSubmit={search}>
        <TextField
          placeholder="Search for a street, place or postcode"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <CircularProgress size={18} />
              ) : (
                <IconButton type="submit" edge="end" aria-label="Search" size="small">
                  <SearchRounded fontSize="small" />
                </IconButton>
              ),
            },
          }}
        />
        {searchError && (
          <Alert severity="warning" variant="outlined" sx={{ mt: 1.5 }} onClose={() => setSearchError(null)}>
            {searchError}
          </Alert>
        )}
      </Box>

      <Box
        sx={{
          position: 'relative',
          height: { xs: 340, md: 440 },
          borderRadius: 3,
          overflow: 'hidden',
          border: 1.5,
          borderColor: errors.location ? 'error.main' : 'divider',
          '& .leaflet-container': { height: '100%', fontFamily: theme.typography.fontFamily, cursor: 'crosshair' },
        }}
      >
        <MapContainer center={loc ? [loc.latitude, loc.longitude] : SOUTHAMPTON} zoom={loc ? 16 : 13} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={place} />
          <FlyTo target={flyTarget} />
          {loc && (
            <>
              <Circle
                center={[loc.latitude, loc.longitude]}
                radius={loc.radius_m}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.12 }}
              />
              <Marker
                position={[loc.latitude, loc.longitude]}
                icon={pin}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng()
                    place(lat, lng)
                  },
                }}
              />
            </>
          )}
        </MapContainer>

        {!loc && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 16,
              transform: 'translateX(-50%)',
              zIndex: 1000,
              alignItems: 'center',
              px: 2,
              py: 1,
              borderRadius: 99,
              bgcolor: 'background.paper',
              boxShadow: 2,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <TouchAppOutlined fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Click the map to place the project
            </Typography>
          </Stack>
        )}
      </Box>
      {errors.location && (
        <Typography variant="body2" color="error" sx={{ mt: -1.5 }}>
          {errors.location}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, gap: 3 }}>
        <FieldGroup
          title="Radius"
          hint={loc ? `Residents within ${formatRadius(radius)} of the pin will see this as local.` : 'Place the pin first.'}
        >
          <Box sx={{ px: 1 }}>
            <Slider
              value={radius}
              min={25}
              max={2000}
              step={25}
              disabled={!loc}
              valueLabelDisplay="auto"
              valueLabelFormat={formatRadius}
              marks={[100, 500, 1000, 2000].map((value) => ({ value, label: formatRadius(value) }))}
              onChange={(_, value) => loc && update({ location: { ...loc, radius_m: value as number } })}
              aria-label="Radius"
              sx={{ color }}
            />
          </Box>
        </FieldGroup>

        <FieldGroup title="Ward" hint="Optional.">
          <TextField
            value={form.ward ?? ''}
            onChange={(e) => update({ ward: e.target.value || null })}
            slotProps={{ htmlInput: { maxLength: 100, 'aria-label': 'Ward' } }}
            fullWidth
          />
        </FieldGroup>
      </Box>
    </Stack>
  )
}
