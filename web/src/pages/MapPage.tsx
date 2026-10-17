import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import AddRounded from '@mui/icons-material/AddRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import FilterListRounded from '@mui/icons-material/FilterListRounded'
import CenterFocusStrongOutlined from '@mui/icons-material/CenterFocusStrongOutlined'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlineOutlined'
import { useCommunityIssues } from '../hooks/useCommunityIssues'
import IssueDetails from '../components/issues/IssueDetails'
import { useLiveEvents } from '../hooks/useLiveEvents'
import LiveMap, { type MapCommand } from '../components/map/LiveMap'
import { APP_PIN_COLOR } from '../components/map/pinIcon'
import EventPanel from '../components/events/EventPanel'
import LiveIndicator from '../components/events/LiveIndicator'
import type { LatLng } from '../components/events/LocationPicker'
import { useEventActions } from '../components/events/useEventActions'
import { searchPlace } from '../utils/geocode'
import { eventDeadlineLabel, isOpen } from '../utils/eventDeadline'
import { formatNumber } from '../utils/format'

/** The app's Map tab: the same pins and event panel, with moderation tools. */
export default function MapPage() {
  const { events, error, status, updatedAt, newIds, reload } = useLiveEvents()
  const { issues, error: issuesError, refresh: refreshIssues } = useCommunityIssues()
  const [params, setParams] = useSearchParams()
  const selectedId = /^\d+$/.test(params.get('event') ?? '') ? Number(params.get('event')) : null
  const selectedIssue = issues.find((issue) => String(issue.id) === params.get('issue'))
  const [filter, setFilter] = useState('')
  const [command, setCommand] = useState<MapCommand>(null)
  const [commandId, setCommandId] = useState(0)
  const [place, setPlace] = useState('')
  const [searching, setSearching] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const centerRef = useRef<LatLng>([50.9097, -1.4044])

  const run = (next: MapCommand) => {
    setCommand(next)
    setCommandId((n) => n + 1)
  }
  const select = (id: number | null) =>
    setParams((p) => {
      p.delete('issue')
      if (id === null) p.delete('event')
      else p.set('event', String(id))
      return p
    })

  const actions = useEventActions({
    onChanged: reload,
    onCreated: (event) => select(event.id),
    onDeleted: (id) => id === selectedId && select(null),
  })

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (events ?? [])
      .filter((e) => !q || [e.title, e.description].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => b.id - a.id)
  }, [events, filter])

  const selected = events?.find((e) => e.id === selectedId)

  async function searchForPlace(e: FormEvent) {
    e.preventDefault()
    if (!place.trim()) return
    setSearching(true)
    setPlaceError(null)
    try {
      const target = await searchPlace(place)
      if (target) run({ kind: 'fly', to: target })
      else setPlaceError('No match in Southampton. Try a street name or postcode.')
    } catch {
      setPlaceError('Place search is unavailable right now.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        maxWidth: 1600,
        mx: 'auto',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '380px minmax(0, 1fr)' },
        gridTemplateRows: { xs: 'minmax(360px, 58dvh) auto', md: '1fr' },
        // Fill the space under the top bar (64px) and the page padding
        height: { md: 'calc(100dvh - 64px - 64px)' },
        minHeight: { md: 520 },
      }}
    >
      {/* Sidebar: the event list, or the selected event's panel */}
      <Box
        component="section"
        aria-label={selected ? 'Event details' : 'Events on the map'}
        sx={{
          order: { xs: 2, md: 1 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: { md: 1 },
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
        }}
      >
        {selectedIssue ? (
          <Box sx={{ overflowY: 'auto' }}>
            <Button sx={{ m: 2, mb: 0 }} onClick={() => select(null)}>Close issue</Button>
            <IssueDetails issue={selectedIssue} />
          </Box>
        ) : selected ? (
          <EventPanel
            key={selected.id}
            event={selected}
            onClose={() => select(null)}
            onEdit={() => actions.editEvent(selected)}
            onDelete={() => actions.removeEvent(selected)}
            onDeleteComment={actions.removeComment}
          />
        ) : (
          <>
            <Box sx={{ p: 2.5, pb: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                <Typography variant="h6" component="h1" sx={{ fontWeight: 650 }}>
                  Map
                </Typography>
                <LiveIndicator status={status} updatedAt={updatedAt} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Exactly what residents see on the app’s map. Pick a pin to moderate it.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                fullWidth
                onClick={() => actions.addEvent(centerRef.current)}
                sx={{ mb: 2 }}
              >
                Add event
              </Button>
              <TextField
                size="small"
                placeholder="Filter events"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <FilterListRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { 'aria-label': 'Filter events' },
                }}
              />
            </Box>

            {error && (
              <Alert
                severity="error"
                variant="outlined"
                sx={{ mx: 2.5, mb: 1 }}
                action={
                  <Button color="inherit" size="small" onClick={reload} sx={{ py: 0.5 }}>
                    Retry
                  </Button>
                }
              >
                {error}
              </Alert>
            )}

            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
              {!events &&
                !error &&
                Array.from({ length: 6 }, (_, i) => (
                  <Box component="li" key={i} sx={{ px: 2.5, py: 1.5 }}>
                    <Skeleton width="80%" />
                    <Skeleton width="45%" />
                  </Box>
                ))}
              {events && visible.length === 0 && (
                <Typography component="li" variant="body2" color="text.secondary" sx={{ px: 2.5, py: 2 }}>
                  {events.length ? 'No events match this filter.' : 'No events yet. Add one and it appears in the app.'}
                </Typography>
              )}
              {visible.map((e) => (
                <li key={e.id}>
                  <ButtonBase
                    onClick={() => select(e.id)}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      px: 2.5,
                      py: 1.5,
                      borderTop: 1,
                      borderColor: 'divider',
                      opacity: isOpen(e.closes_at) ? 1 : 0.65,
                      '&:hover, &.Mui-focusVisible': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: APP_PIN_COLOR, mt: 0.75, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                          {e.title}
                        </Typography>
                        {newIds.has(e.id) && (
                          <Chip label="New" size="small" color="primary" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700 }} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap component="p">
                        {eventDeadlineLabel(e.closes_at)}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0, mt: 0.25 }}
                      aria-label={`${e.comments} comments`}
                    >
                      <ChatBubbleOutline sx={{ fontSize: 15 }} />
                      <Typography variant="caption">{formatNumber(e.comments)}</Typography>
                    </Stack>
                  </ButtonBase>
                </li>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Map */}
      <Box sx={{ order: { xs: 1, md: 2 }, position: 'relative', minHeight: 0 }}>
        {issuesError && <Alert severity="warning" action={<Button color="inherit" onClick={refreshIssues}>Retry</Button>} sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>{issuesError}</Alert>}
        <Box sx={{ position: 'absolute', bottom: 28, left: 12, zIndex: 500, bgcolor: 'background.paper', borderRadius: 2, p: 1 }}>
          <Typography variant="caption" component="p" sx={{ color: APP_PIN_COLOR }}>● Council projects</Typography>
          {selectedIssue && <Typography variant="caption" component="p" sx={{ color: '#bf6b24' }}>● Selected issue</Typography>}
        </Box>
        <LiveMap
          issues={selectedIssue ? [selectedIssue] : []} selectedIssueId={selectedIssue?.id}
          onSelectIssue={(id) => setParams({ issue: String(id) })}
          events={visible}
          selectedId={selectedId}
          freshIds={newIds}
          onSelect={select}
          command={command}
          commandId={commandId}
          centerRef={centerRef}
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 1000,
            alignItems: { sm: 'flex-start' },
            pointerEvents: 'none',
          }}
        >
          <Box component="form" onSubmit={searchForPlace} sx={{ flexGrow: 1, maxWidth: 380, pointerEvents: 'auto' }}>
            <TextField
              size="small"
              placeholder="Go to a street, place or postcode"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { boxShadow: 2, bgcolor: 'background.paper' } }}
              slotProps={{
                htmlInput: { 'aria-label': 'Go to a place' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searching ? <CircularProgress size={18} /> : null,
                },
              }}
            />
            {placeError && (
              <Alert severity="warning" variant="filled" onClose={() => setPlaceError(null)} sx={{ mt: 1, py: 0 }}>
                {placeError}
              </Alert>
            )}
          </Box>
          <Stack direction="row" spacing={1} sx={{ pointerEvents: 'auto', ml: { sm: 'auto !important' } }}>
            <Tooltip title="Show every event">
              <Button
                variant="contained"
                color="inherit"
                size="small"
                startIcon={<CenterFocusStrongOutlined />}
                onClick={() => run({ kind: 'fit' })}
                sx={{
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  boxShadow: 2,
                  py: 0.75,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                Show all
              </Button>
            </Tooltip>
            <Tooltip title="Back to the city view">
              <IconButton
                aria-label="Back to the city view"
                onClick={() => run({ kind: 'home' })}
                sx={{ bgcolor: 'background.paper', boxShadow: 2, borderRadius: 2, '&:hover': { bgcolor: 'background.paper' } }}
              >
                <HomeOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>

      {actions.dialogs}
    </Paper>
  )
}
