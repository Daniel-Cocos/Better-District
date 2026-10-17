import { Link as RouterLink } from 'react-router'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import { useTheme, alpha } from '@mui/material/styles'
import ArrowForward from '@mui/icons-material/ArrowForwardRounded'
import type { Post } from '../../api/overview'
import { stageMeta, stageOrder } from '../postMeta'

/*
 * A stylised, offline preview of where posts sit in the city — not a tile map.
 * Coordinates are projected into a fixed box around central Southampton;
 * the full interactive map lives on the City map page.
 */
const W = 800
const H = 560
const BOUNDS = { north: 50.948, south: 50.885, west: -1.475, east: -1.355 }

const project = (lat: number, lng: number) => [
  ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W,
  ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H,
]

const toPath = (pts: [number, number][], close = false) =>
  pts.map(([lat, lng], i) => `${i ? 'L' : 'M'}${project(lat, lng).map((n) => n.toFixed(1)).join(' ')}`).join(' ') +
  (close ? ' Z' : '')

// Rough outline of the Test estuary and River Itchen
const WATER = toPath(
  [
    [50.93, -1.475], [50.919, -1.452], [50.909, -1.43], [50.901, -1.414], [50.896, -1.4], [50.894, -1.392],
    [50.901, -1.39], [50.911, -1.388], [50.921, -1.384], [50.931, -1.381], [50.94, -1.379], [50.948, -1.378],
    [50.948, -1.372], [50.94, -1.373], [50.93, -1.375], [50.92, -1.379], [50.91, -1.382], [50.9, -1.384],
    [50.893, -1.383], [50.885, -1.372], [50.885, -1.475],
  ],
  true,
)

const ROADS = [
  [[50.904, -1.404], [50.915, -1.402], [50.93, -1.401], [50.948, -1.398]], // The Avenue
  [[50.909, -1.41], [50.917, -1.425], [50.925, -1.44], [50.934, -1.462]], // Shirley Road
  [[50.913, -1.4], [50.924, -1.395], [50.935, -1.39], [50.945, -1.386]], // Portswood
  [[50.912, -1.389], [50.916, -1.375], [50.921, -1.36]], // Bitterne
  [[50.899, -1.396], [50.898, -1.384], [50.896, -1.37], [50.893, -1.355]], // Itchen Bridge
] as [number, number][][]

export default function CityMapPreview({ posts, loading }: { posts?: Post[]; loading?: boolean }) {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const mapped = posts ?? []

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 650 }}>
            Across the city
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Where every published project sits
          </Typography>
        </Box>
        <Button component={RouterLink} to="/map" size="small" endIcon={<ArrowForward />} sx={{ flexShrink: 0, py: 0.75 }}>
          Open map
        </Button>
      </Stack>

      <Box
        sx={{
          position: 'relative',
          flexGrow: 1,
          minHeight: 260,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: alpha(primary, 0.03),
          border: 1,
          borderColor: 'divider',
        }}
      >
        {loading ? (
          <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, height: '100%' }} />
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={`Map preview showing ${mapped.length} located posts`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {Array.from({ length: W / 40 + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={H} stroke={alpha(primary, 0.06)} />
            ))}
            {Array.from({ length: H / 40 + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 40} x2={W} y2={i * 40} stroke={alpha(primary, 0.06)} />
            ))}
            <path d={WATER} fill={alpha(primary, 0.12)} stroke={alpha(primary, 0.25)} strokeWidth={1.5} />
            {ROADS.map((r, i) => (
              <path
                key={i}
                d={toPath(r)}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {ROADS.map((r, i) => (
              <path
                key={`o${i}`}
                d={toPath(r)}
                fill="none"
                stroke={alpha(primary, 0.18)}
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {mapped.map((p) => {
              const [x, y] = project(p.location.latitude, p.location.longitude)
              const { color, label } = stageMeta[p.stage]
              return (
                <Tooltip key={p.id} title={`${p.title} · ${label}`} arrow>
                  <g transform={`translate(${x} ${y})`} style={{ cursor: 'pointer' }}>
                    <circle r={20} fill={alpha(color, 0.14)} />
                    <path
                      d="M0 10 C -10 -2, -12 -8, -12 -14 A 12 12 0 1 1 12 -14 C 12 -8, 10 -2, 0 10 Z"
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    <circle cy={-14} r={4.5} fill="#FFFFFF" />
                  </g>
                </Tooltip>
              )
            })}
          </svg>
        )}
      </Box>

      <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2.5, rowGap: 1, mt: 2, alignItems: 'center' }}>
        {stageOrder.map((s) => (
          <Stack key={s} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: stageMeta[s].color }} />
            <Typography variant="caption" color="text.secondary">
              {stageMeta[s].label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  )
}
