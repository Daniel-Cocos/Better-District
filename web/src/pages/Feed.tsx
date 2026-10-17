import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import AddRounded from '@mui/icons-material/AddRounded'
import FilterListRounded from '@mui/icons-material/FilterListRounded'
import { useLiveEvents } from '../hooks/useLiveEvents'
import EventCard from '../components/events/EventCard'
import LiveIndicator from '../components/events/LiveIndicator'
import { useEventActions } from '../components/events/useEventActions'
import { isOpen } from '../utils/eventDeadline'

type Show = 'all' | 'open' | 'closed'

/** The app's Feed tab: the same cards in the same order, with edit and delete. */
export default function Feed() {
  const { events, error, status, updatedAt, newIds, reload } = useLiveEvents()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const [show, setShow] = useState<Show>('all')
  const actions = useEventActions({ onChanged: reload })

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (events ?? []).filter(
      (e) =>
        (show === 'all' || isOpen(e.closes_at) === (show === 'open')) &&
        (!q || [e.title, e.description].some((s) => s.toLowerCase().includes(q))),
    )
  }, [events, filter, show])

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 2, mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography variant="h2" component="h1">
              Feed
            </Typography>
            <LiveIndicator status={status} updatedAt={updatedAt} />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Every event in the app’s feed, in the same order residents see it.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => actions.addEvent()}>
          Add event
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Filter events"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
          slotProps={{
            htmlInput: { 'aria-label': 'Filter events' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={show}
          onChange={(_, next: Show | null) => next && setShow(next)}
          aria-label="Show events"
          sx={{ bgcolor: 'background.paper' }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="open">Open</ToggleButton>
          <ToggleButton value="closed">Closed</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 2, bgcolor: 'background.paper' }}
          action={
            <Button color="inherit" size="small" onClick={reload} sx={{ py: 0.5 }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {!events && !error && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} component="li" variant="rounded" height={128} />)}
        {visible.map((e) => (
          <li key={e.id}>
            <EventCard
              event={e}
              isNew={newIds.has(e.id)}
              onOpen={() => navigate(`/map?event=${e.id}`)}
              onEdit={() => actions.editEvent(e)}
              onDelete={() => actions.removeEvent(e)}
            />
          </li>
        ))}
      </Stack>
      {events && visible.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {events.length ? 'No events match.' : 'No events yet. Add one and it appears in the app.'}
        </Typography>
      )}

      {actions.dialogs}
    </Box>
  )
}
