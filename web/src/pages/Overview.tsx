import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Paper from '@mui/material/Paper'
import ButtonBase from '@mui/material/ButtonBase'
import AddRounded from '@mui/icons-material/AddRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import ChevronRight from '@mui/icons-material/ChevronRightRounded'
import { fetchOverview, type Overview as OverviewData } from '../api/overview'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import StatCard from '../components/overview/StatCard'
import CityMapPreview from '../components/overview/CityMapPreview'
import ActivityFeed from '../components/overview/ActivityFeed'
import PostList from '../components/overview/PostList'
import { stageMeta } from '../components/postMeta'
import { formatNumber, greeting, relativeTime } from '../utils/format'

const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export default function Overview() {
  const { user } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => new Date())
  // A one-off message passed from the project wizard after publishing
  const location = useLocation()
  const navigate = useNavigate()
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  const load = useCallback((signal?: AbortSignal) => {
    fetchOverview(signal)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((err) => {
        if (!signal?.aborted) setError(errorMessage(err, 'Couldn’t load the overview.'))
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  function retry() {
    setLoading(true)
    setError(null)
    load()
  }

  const s = data?.stats
  const firstName = user?.name.split(' ')[0]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      {/* Page header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 2, mb: 4 }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {today.format(now)}
          </Typography>
          <Typography variant="h2" component="h1" sx={{ mt: 0.5 }}>
            {greeting(now)}
            {firstName && `, ${firstName}`}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Here’s what’s happening across Southampton.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button component={RouterLink} to="/map" variant="outlined" startIcon={<MapOutlined />} sx={{ bgcolor: 'background.paper' }}>
            Open map
          </Button>
          <Button component={RouterLink} to="/projects/new" variant="contained" startIcon={<AddRounded />}>
            New project
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mb: 3, bgcolor: 'background.paper' }}
          action={
            <Button color="inherit" size="small" onClick={retry} sx={{ py: 0.5 }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {data && data.drafts.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2.5, py: 1.5, bgcolor: 'primary.light' }}>
            <EditNoteOutlined sx={{ color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {data.drafts.length === 1 ? '1 unpublished draft' : `${data.drafts.length} unpublished drafts`}
            </Typography>
          </Stack>
          {data.drafts.slice(0, 3).map((d) => (
            <ButtonBase
              key={d.id}
              component={RouterLink}
              to={`/projects/new?draft=${d.id}`}
              sx={{
                width: '100%',
                justifyContent: 'space-between',
                gap: 2,
                px: 2.5,
                py: 1.25,
                borderTop: 1,
                borderColor: 'divider',
                textAlign: 'left',
                '&:hover': { bgcolor: 'background.default' },
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {d.title}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0 }}>
                <Typography variant="caption">Edited {relativeTime(d.updated_at)}</Typography>
                <ChevronRight fontSize="small" />
              </Stack>
            </ButtonBase>
          ))}
        </Paper>
      )}

      {/* Headline numbers */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 2,
        }}
      >
        <StatCard
          label="Open proposals"
          value={s && formatNumber(s.open_consultations)}
          icon={<CampaignOutlined />}
          accent={stageMeta.proposal.color}
          soft={stageMeta.proposal.soft}
          footer="Asking residents for views"
          loading={loading && !data}
        />
        <StatCard
          label="Live trials"
          value={s && formatNumber(s.live_trials)}
          icon={<ConstructionOutlined />}
          accent={stageMeta.live_trial.color}
          soft={stageMeta.live_trial.soft}
          footer="Running on site now"
          loading={loading && !data}
        />
        <StatCard
          label="Built"
          value={s && formatNumber(s.completed)}
          icon={<TaskAltOutlined />}
          accent={stageMeta.built.color}
          soft={stageMeta.built.soft}
          footer="Finished and in place"
          loading={loading && !data}
        />
        <StatCard
          label="Resident responses"
          value={s && formatNumber(s.comments + s.reactions)}
          icon={<ForumOutlined />}
          accent="#6B5CA5"
          soft="#EFECF7"
          loading={loading && !data}
          footer={s && `${formatNumber(s.comments)} comments · ${formatNumber(s.reactions)} likes and dislikes`}
        />
      </Box>

      {/* Map + activity */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: 2,
          mb: 2,
        }}
      >
        <CityMapPreview posts={data?.posts} loading={loading && !data} />
        <ActivityFeed comments={data?.recent_comments} loading={loading && !data} />
      </Box>

      <PostList posts={data?.posts} loading={loading && !data} />

      <Snackbar
        open={Boolean(flash)}
        message={flash}
        autoHideDuration={5000}
        onClose={() => setFlash(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
