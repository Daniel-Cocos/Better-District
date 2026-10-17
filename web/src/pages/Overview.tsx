import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import AddRounded from '@mui/icons-material/AddRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import EventOutlined from '@mui/icons-material/EventOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import ThumbsUpDownOutlined from '@mui/icons-material/ThumbsUpDownOutlined'
import PeopleOutline from '@mui/icons-material/PeopleOutlineOutlined'
import ChevronRight from '@mui/icons-material/ChevronRightRounded'
import { fetchOverview, type Overview as OverviewData } from '../api/overview'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useLiveEvents } from '../hooks/useLiveEvents'
import StatCard from '../components/overview/StatCard'
import CommentItem from '../components/events/CommentItem'
import LiveIndicator from '../components/events/LiveIndicator'
import { useEventActions } from '../components/events/useEventActions'
import { eventDeadlineLabel, isOpen } from '../utils/eventDeadline'
import { formatNumber, greeting } from '../utils/format'

const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** A summary of everything in the app, with quick moderation of the latest comments. */
export default function Overview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { events, status, updatedAt, reload } = useLiveEvents()
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const actions = useEventActions({ onChanged: reload })

  // The numbers follow the live events: each refresh there means something changed
  useEffect(() => {
    const ctrl = new AbortController()
    fetchOverview(ctrl.signal)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Couldn’t load the overview.'))
      })
    return () => ctrl.abort()
  }, [updatedAt])

  // Open events, soonest deadline first
  const closingSoon = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.closes_at && isOpen(e.closes_at))
        .sort((a, b) => (a.closes_at ?? '').localeCompare(b.closes_at ?? ''))
        .slice(0, 6),
    [events],
  )

  const s = data?.stats
  const loading = !data && !error
  const firstName = user?.name.split(' ')[0]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 2, mb: 4 }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {today.format(now)}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Typography variant="h2" component="h1">
              {greeting(now)}
              {firstName && `, ${firstName}`}
            </Typography>
            <LiveIndicator status={status} updatedAt={updatedAt} />
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Here’s what’s happening in the Better District app.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button component={RouterLink} to="/map" variant="outlined" startIcon={<MapOutlined />} sx={{ bgcolor: 'background.paper' }}>
            Open map
          </Button>
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => actions.addEvent()}>
            Add event
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 3, bgcolor: 'background.paper' }}
          action={
            <Button color="inherit" size="small" onClick={reload} sx={{ py: 0.5 }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {Boolean(s?.flagged_comments) && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ mb: 3, bgcolor: 'background.paper' }}
          action={
            <Button component={RouterLink} to="/flagged" color="inherit" size="small" sx={{ py: 0.5 }}>
              Review
            </Button>
          }
        >
          {s?.flagged_comments === 1
            ? '1 reported comment is hidden from the app until you review it.'
            : `${s?.flagged_comments} reported comments are hidden from the app until you review them.`}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 2,
        }}
      >
        <StatCard
          label="Events in the app"
          value={s && formatNumber(s.events)}
          icon={<EventOutlined />}
          accent="#3E6FA8"
          soft="#E6EEF8"
          footer={s && `${formatNumber(s.open_events)} open · ${formatNumber(s.events - s.open_events)} closed`}
          loading={loading}
        />
        <StatCard
          label="Comments"
          value={s && formatNumber(s.comments)}
          icon={<ForumOutlined />}
          accent="#6B5CA5"
          soft="#EFECF7"
          footer="From accounts and anonymous guests"
          loading={loading}
        />
        <StatCard
          label="Votes"
          value={s && formatNumber(s.likes + s.dislikes)}
          icon={<ThumbsUpDownOutlined />}
          accent="#2F8A87"
          soft="#E3F2F1"
          footer={s && `${formatNumber(s.likes)} likes · ${formatNumber(s.dislikes)} dislikes`}
          loading={loading}
        />
        <StatCard
          label="Resident accounts"
          value={s && formatNumber(s.residents)}
          icon={<PeopleOutline />}
          accent="#5E7A4B"
          soft="#EBF1E6"
          footer="Guests can also take part anonymously"
          loading={loading}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 650 }}>
            Latest comments
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What residents are saying. Remove anything that breaks the rules.
          </Typography>
          <Stack component="ol" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {loading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} component="li" variant="rounded" height={84} />)}
            {data?.recent_comments.map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} context={`On ${c.event_title}`} onDelete={() => actions.removeComment(c)} />
              </li>
            ))}
          </Stack>
          {data?.recent_comments.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No comments yet.
            </Typography>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, alignSelf: 'start' }}>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 650 }}>
            Closing soon
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Open events, soonest deadline first
          </Typography>
          {!events && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={48} />)}
          {events && closingSoon.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No open events.
            </Typography>
          )}
          {closingSoon.map((e, i) => (
            <ButtonBase
              key={e.id}
              onClick={() => navigate(`/map?event=${e.id}`)}
              sx={{
                width: '100%',
                justifyContent: 'space-between',
                gap: 2,
                py: 1.25,
                borderTop: i ? 1 : 0,
                borderColor: 'divider',
                textAlign: 'left',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {eventDeadlineLabel(e.closes_at)}
                </Typography>
              </Box>
              <ChevronRight fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            </ButtonBase>
          ))}
        </Paper>
      </Box>

      {actions.dialogs}
    </Box>
  )
}
