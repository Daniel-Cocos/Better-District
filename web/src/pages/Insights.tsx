import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Drawer from '@mui/material/Drawer'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import ThumbsUpDownOutlined from '@mui/icons-material/ThumbsUpDownOutlined'
import { errorMessage } from '../api/client'
import { subscribeToChanges } from '../api/events'
import { fetchInsights, refreshInsights, type InsightPlan, type Insights as InsightsData } from '../api/insights'
import StatCard from '../components/overview/StatCard'
import BriefingCard from '../components/insights/BriefingCard'
import CrossCuttingCard from '../components/insights/CrossCuttingCard'
import PlanDetail from '../components/insights/PlanDetail'
import { AttentionChip } from '../components/insights/Chips'
import { StanceBar, StanceLegend, VoteBar } from '../components/insights/Bars'
import { percent, stanceColor, stanceCounts } from '../components/insights/stance'
import { formatNumber } from '../utils/format'

type Filter = 'all' | 'open' | 'closed'
type Sort = 'attention' | 'approval' | 'comments'
const LEVEL_ORDER = { high: 0, medium: 1, low: 2 }

/** Loads the page data, follows live changes, and polls while a background run is going. */
function useInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      clearTimeout(timer)
      try {
        const next = await fetchInsights()
        if (!alive) return
        setData(next)
        setError(null)
        if (next.job.running) timer = setTimeout(load, 2500)
      } catch (err) {
        if (alive) setError(errorMessage(err, 'Couldn’t load insights.'))
      }
    }
    loadRef.current = () => void load()
    void load()
    let version: string | null = null
    const unsubscribe = subscribeToChanges((next) => {
      const first = version === null
      if (next === version) return
      version = next
      if (!first) void load()
    }, () => {})
    return () => {
      alive = false
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  const reload = useCallback(() => loadRef.current(), [])
  return { data, setData, error, reload }
}

/** The core of the admin website: what residents think of every plan, and where the council should pivot. */
export default function Insights() {
  const { mode } = useTheme().palette
  const { data, setData, error, reload } = useInsights()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('attention')
  const [startError, setStartError] = useState<string | null>(null)
  const autoStarted = useRef(false)

  const start = useCallback(
    async (force = false) => {
      try {
        setData(await refreshInsights(force))
        setStartError(null)
        reload() // begins polling while the run goes
      } catch (err) {
        setStartError(errorMessage(err, 'Couldn’t start the analysis.'))
      }
    },
    [reload, setData],
  )

  const briefingOutdated = Boolean(data && data.totals.analysed > 0 && (!data.briefing || data.briefing.stale))
  // Bring everything up to date once when the page opens
  useEffect(() => {
    if (!data || autoStarted.current || data.job.running) return
    autoStarted.current = true
    // Starts a server-side job; state only changes once the request returns
    // oxlint-disable-next-line react/set-state-in-effect
    if (data.pending > 0 || briefingOutdated) void start()
  }, [data, briefingOutdated, start])

  const selectedId = Number(params.get('plan')) || null
  const selected = data?.plans.find((p) => p.id === selectedId) ?? null
  const openPlan = (id: number | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id === null) next.delete('plan')
      else next.set('plan', String(id))
      return next
    })

  const plans = useMemo(() => {
    const list = (data?.plans ?? []).filter((p) => filter === 'all' || (filter === 'open') === p.is_open)
    const byApproval = (p: InsightPlan) => p.approval ?? 1
    return list.slice().sort((a, b) => {
      if (sort === 'comments') return b.comments - a.comments
      if (sort === 'approval') return byApproval(a) - byApproval(b)
      return LEVEL_ORDER[a.attention.level] - LEVEL_ORDER[b.attention.level] || byApproval(a) - byApproval(b)
    })
  }, [data, filter, sort])

  const t = data?.totals
  const job = data?.job
  const objecting = t ? t.types.filter((x) => x.type === 'oppose' || x.type === 'concern').reduce((s, x) => s + x.count, 0) : 0
  const supporting = t?.types.find((x) => x.type === 'support')?.count ?? 0
  const loading = !data && !error
  const working = Boolean(job?.running)

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>Resident insights</Typography>
          <Typography variant="h2" component="h1">Where residents stand</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            Every plan’s votes and comments, read by the council’s own AI model, so you can see what’s working and where to change course.
            Comments never leave council machines.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshRounded />} disabled={working || !data} onClick={() => void start()} sx={{ bgcolor: 'background.paper' }}>
            Update
          </Button>
          <Button disabled={working || !data} onClick={() => void start(true)}>Re-analyse all</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={reload}>Retry</Button>}>{error}</Alert>}
      {startError && <Alert severity="error" sx={{ mb: 2 }}>{startError}</Alert>}
      {job?.error && !working && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}
          action={<Button color="inherit" onClick={() => void start()}>Try again</Button>}>
          {job.error}
          {job.failed > 0 && ` (${job.failed} step${job.failed === 1 ? '' : 's'} failed)`}
        </Alert>
      )}

      {working && job && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }} role="status">
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <AutoAwesomeOutlined sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {job.total ? `Analysing ${Math.min(job.done + 1, job.total)} of ${job.total}` : 'Starting analysis'}
                {job.current && `: ${job.current}`}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">Results appear as each plan finishes</Typography>
          </Stack>
          <LinearProgress variant={job.total ? 'determinate' : 'indeterminate'} value={job.total ? (job.done / job.total) * 100 : 0}
            sx={{ mt: 1.5, height: 6, borderRadius: 3 }} />
        </Paper>
      )}

      {/* Headline numbers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mb: 2 }}>
        <StatCard label="Resident approval" loading={loading} icon={<ThumbsUpDownOutlined />} accent="#3E6FA8" soft="#E6EEF8"
          value={t ? (t.approval === null ? '–' : percent(t.approval)) : undefined}
          footer={t && `${formatNumber(t.likes)} likes · ${formatNumber(t.dislikes)} dislikes across ${t.plans} plans`} />
        <StatCard label="Plans needing attention" loading={loading} icon={<ErrorOutlineRounded />} accent="#B3261E" soft="#FBE9E7"
          value={t && formatNumber(t.high_attention)}
          footer={t && `${formatNumber(t.medium_attention)} more worth watching`} />
        <StatCard label="Objections & concerns" loading={loading} icon={<ReportProblemOutlined />} accent="#A15C00" soft="#FDF0E1"
          value={t ? (t.classified ? percent(objecting / t.classified) : '–') : undefined}
          footer={t && (t.classified ? `of analysed comments · ${percent(supporting / t.classified)} are supportive` : 'No comments analysed yet')} />
        <StatCard label="Comments analysed" loading={loading} icon={<ForumOutlined />} accent="#6B5CA5" soft="#EFECF7"
          value={t && formatNumber(t.classified)}
          footer={t && `of ${formatNumber(t.comments)} comments · ${t.analysed} of ${t.plans} plans up to date`} />
      </Box>

      {/* Briefing beside the city-wide comment mix */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(0, 5fr)' }, gap: 2, mb: 2, alignItems: 'start' }}>
        {loading ? <Skeleton variant="rounded" height={320} /> : <BriefingCard briefing={data?.briefing ?? null} working={working} onOpenPlan={openPlan} />}

        <Stack spacing={2}>
        <Paper variant="outlined" component="section" aria-label="What residents are saying" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>What residents are saying</Typography>
          <Typography variant="caption" color="text.secondary">
            {t ? `${formatNumber(t.classified)} comments across ${t.analysed} analysed plans` : ' '}
          </Typography>
          {t && t.classified > 0 ? (
            <>
              <Box sx={{ mt: 2 }}><StanceBar types={t.types} height={18} label="Comments across all plans" /></Box>
              <Box sx={{ mt: 1.5 }}><StanceLegend /></Box>
              <Box component="table" sx={{ width: '100%', mt: 2, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums',
                '& td, & th': { py: 0.75, borderTop: 1, borderColor: 'divider', typography: 'body2' }, '& th': { fontWeight: 400, textAlign: 'left' } }}>
                <tbody>
                  {stanceCounts(t.types).map((s) => (
                    <tr key={s.key}>
                      <th scope="row">
                        <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '3px', mr: 1, bgcolor: stanceColor(mode, s.key) }} />
                        {s.label}
                      </th>
                      <td style={{ textAlign: 'right' }}>{formatNumber(s.count)}</td>
                      <Box component="td" sx={{ textAlign: 'right', width: 56, color: 'text.secondary' }}>{percent(s.count / t.classified)}</Box>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {working ? 'Filling in as plans are analysed…' : 'No comments analysed yet.'}
            </Typography>
          )}
        </Paper>
          {data?.briefing && <CrossCuttingCard briefing={data.briefing} onOpenPlan={openPlan} />}
        </Stack>
      </Box>

      {/* Every plan, most in need of attention first */}
      <Paper variant="outlined" component="section" aria-label="Plans" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 1.5 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 650 }}>Plan by plan</Typography>
            <Typography variant="caption" color="text.secondary">Select a plan for its summary and recommended changes</Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)} aria-label="Show plans">
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="open">Open</ToggleButton>
              <ToggleButton value="closed">Closed</ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} sx={{ minWidth: 170 }}>
              <MenuItem value="attention">Needs attention</MenuItem>
              <MenuItem value="approval">Lowest approval</MenuItem>
              <MenuItem value="comments">Most comments</MenuItem>
            </TextField>
          </Stack>
        </Stack>

        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(0, 2.4fr) 140px minmax(0, 1.8fr) 160px', gap: 2, mt: 2.5, mb: 1, px: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Plan</Typography>
          <Typography variant="caption" color="text.secondary">Votes</Typography>
          <Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>Comment mix</Typography>
            <StanceLegend />
          </Box>
          <Typography variant="caption" color="text.secondary">Status</Typography>
        </Box>
        <Box sx={{ display: { md: 'none' }, mt: 2 }}><StanceLegend /></Box>

        <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0, mt: { xs: 1.5, md: 0 } }}>
          {loading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} component="li" height={64} />)}
          {plans.map((p) => (
            <li key={p.id}>
              <ButtonBase onClick={() => openPlan(p.id)} aria-label={`${p.title}: open insights`}
                sx={{ width: '100%', textAlign: 'left', display: 'grid', alignItems: 'center', gap: { xs: 1, md: 2 }, px: 1.5, py: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2.4fr) 140px minmax(0, 1.8fr) 160px' },
                  borderTop: 1, borderColor: 'divider', borderRadius: 1, bgcolor: p.id === selectedId ? 'action.selected' : undefined,
                  '&:hover': { bgcolor: 'action.hover' } }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{p.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {p.is_open ? 'Open' : 'Closed'} · {formatNumber(p.comments)} comment{p.comments === 1 ? '' : 's'}
                    {p.analysis?.pivots[0] && ` · ${p.analysis.pivots[0].action}`}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {p.approval === null ? 'No votes' : `${percent(p.approval)} approve`}
                  </Typography>
                  {p.likes + p.dislikes > 0 && <Box sx={{ mt: 0.5 }}><VoteBar likes={p.likes} dislikes={p.dislikes} height={6} /></Box>}
                </Box>
                <Box>
                  {p.analysis ? (
                    <StanceBar types={p.analysis.types} label={`${p.title} comment mix`} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {p.comments ? (working ? 'Analysing soon…' : 'Not analysed yet') : 'No comments'}
                    </Typography>
                  )}
                </Box>
                <Box><AttentionChip level={p.attention.level} /></Box>
              </ButtonBase>
            </li>
          ))}
        </Stack>
        {data && plans.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No plans match.</Typography>
        )}
      </Paper>

      <Drawer anchor="right" open={Boolean(selected)} onClose={() => openPlan(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 500 } } } }}>
        {selected && <PlanDetail key={selected.id} plan={selected} onClose={() => openPlan(null)} onChanged={reload} />}
      </Drawer>
    </Box>
  )
}
