import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import { errorMessage } from '../api/client'
import { categoryLabel, ISSUE_CATEGORIES, issuePhotoUrl, type IssueCategory } from '../api/issues'
import { assessReports, fetchReports, type Report, type Reports as ReportsData, type SeverityLevel } from '../api/reports'

type Sort = 'newest' | 'gravity'
const SORTS: Sort[] = ['newest', 'gravity']
const CATEGORY_VALUES = ISSUE_CATEGORIES.map((c) => c.value)

const SEVERITY: Record<SeverityLevel, { label: string; color: string; text: string }> = {
  3: { label: 'Severe', color: '#D32F2F', text: '#FFFFFF' },
  2: { label: 'Moderate', color: '#EF6C00', text: '#FFFFFF' },
  1: { label: 'Minor', color: '#F9C80E', text: '#3A2E00' },
}

const formatDate = (value: string) => new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Loads the gallery, and polls while the model is assessing severity. */
function useReports() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function load() {
      clearTimeout(timer)
      try {
        const next = await fetchReports()
        if (!alive) return
        setData(next)
        setError(null)
        if (next.job.running) timer = setTimeout(load, 2500)
      } catch (err) {
        if (alive) setError(errorMessage(err, 'Couldn’t load reports.'))
      }
    }
    loadRef.current = () => void load()
    void load()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  const reload = useCallback(() => loadRef.current(), [])
  return { data, setData, error, reload }
}

/** Red, orange or yellow dot with the level in it; grey while the model hasn't looked yet. */
function SeverityDot({ report, size = 28 }: { report: Report; size?: number }) {
  const s = report.severity
  const style = s ? SEVERITY[s.level] : { label: 'Not assessed yet', color: '#9AA6B4', text: '#FFFFFF' }
  const title = s ? `${style.label} (${s.level} of 3): ${s.reason}` : style.label
  return (
    <Tooltip title={title} arrow>
      <Box role="img" aria-label={s ? `Severity ${s.level} of 3, ${style.label.toLowerCase()}` : style.label}
        sx={{ width: size, height: size, borderRadius: '50%', bgcolor: style.color, color: style.text, display: 'grid', placeItems: 'center',
          fontSize: size * 0.48, fontWeight: 700, border: '2px solid #FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.35)', flexShrink: 0 }}>
        {s ? s.level : '–'}
      </Box>
    </Tooltip>
  )
}

function ReportCard({ report, onOpen }: { report: Report; onOpen: () => void }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', display: 'flex' }}>
      <ButtonBase onClick={onOpen} sx={{ display: 'block', textAlign: 'left', width: '100%' }} aria-label={`Open report: ${report.title}`}>
        <Box sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: 'action.hover' }}>
          <Box component="img" src={issuePhotoUrl(report.id)} alt="" loading="lazy"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <Box sx={{ position: 'absolute', top: 10, left: 10 }}><SeverityDot report={report} /></Box>
        </Box>
        <Stack spacing={0.75} sx={{ p: 1.5 }}>
          <Typography sx={{ fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{report.title}</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip size="small" label={categoryLabel(report.category)} />
            <Typography variant="caption" color="text.secondary">{formatDate(report.created_at)}</Typography>
          </Stack>
        </Stack>
      </ButtonBase>
    </Paper>
  )
}

function Gallery({ reports, onOpen }: { reports: Report[]; onOpen: (id: number) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 2 }}>
      {reports.map((r) => <ReportCard key={r.id} report={r} onOpen={() => onOpen(r.id)} />)}
    </Box>
  )
}

function ReportDialog({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const navigate = useNavigate()
  const s = report?.severity
  return (
    <Dialog open={Boolean(report)} onClose={onClose} maxWidth="md" fullWidth>
      {report && <>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 3 }}>
          <SeverityDot report={report} size={32} />
          <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{report.title}</Box>
        </DialogTitle>
        <DialogContent>
          <Box component="img" src={issuePhotoUrl(report.id)} alt={report.title}
            sx={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 2, bgcolor: 'action.hover', display: 'block' }} />
          <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" label={categoryLabel(report.category)} />
            <Chip size="small" variant="outlined" label={report.status} sx={{ textTransform: 'capitalize' }} />
            <Typography variant="caption" color="text.secondary">Reported {formatDate(report.created_at)}</Typography>
          </Stack>
          <Typography sx={{ mt: 2, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{report.description}</Typography>
          <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {s ? `Severity ${s.level} of 3 · ${SEVERITY[s.level].label}` : 'Severity not assessed yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {s ? s.reason || 'The model gave no reason.' : 'Sort by Gravity to have the council’s AI model assess it.'}
            </Typography>
            {s && <Typography variant="caption" color="text.secondary">
              Estimated by {s.model}{s.saw_photo ? ' from the photo and description' : ' from the description only (no vision model available)'}
            </Typography>}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate(`/map?issue=${report.id}`)}>View on map</Button>
          <Button variant="contained" onClick={onClose}>Close</Button>
        </DialogActions>
      </>}
    </Dialog>
  )
}

/** Every photo residents have sent, by category, with the model's estimate of how urgent each one is. */
export default function Reports() {
  const { data, setData, error, reload } = useReports()
  const [params, setParams] = useSearchParams()
  const [startError, setStartError] = useState<string | null>(null)
  const autoStarted = useRef(false)
  const sort: Sort = SORTS.find((s) => s === params.get('sort')) ?? 'newest'
  // Chosen categories, always kept in the dropdown's order; none chosen means all of them
  const categoryParam = params.get('categories')
  const categories = useMemo(() => {
    const chosen = new Set(categoryParam?.split(','))
    return CATEGORY_VALUES.filter((c) => chosen.has(c))
  }, [categoryParam])
  const selectedId = Number(params.get('report')) || null
  const selected = data?.reports.find((r) => r.id === selectedId) ?? null

  const setParam = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })

  const start = useCallback(
    async (force = false) => {
      try {
        setData(await assessReports(force))
        setStartError(null)
        reload() // begins polling while the run goes
      } catch (err) {
        setStartError(errorMessage(err, 'Couldn’t start the severity assessment.'))
      }
    },
    [reload, setData],
  )

  // Sorting by gravity needs every report assessed, so start the model once when it's chosen
  useEffect(() => {
    if (sort !== 'gravity') {
      autoStarted.current = false
      return
    }
    if (!data || autoStarted.current || data.job.running) return
    autoStarted.current = true
    // Starts a server-side job; state only changes once the request returns
    // oxlint-disable-next-line react/set-state-in-effect
    if (data.pending > 0) void start()
  }, [sort, data, start])

  const groups = useMemo(() => {
    const reports = data?.reports ?? [] // newest first from the server
    // Newest across everything is one gallery; gravity ranks within each category
    if (sort === 'newest' && !categories.length) return null
    const byLevel = (r: Report) => r.severity?.level ?? 0
    const shown = categories.length ? categories : CATEGORY_VALUES
    return ISSUE_CATEGORIES.filter(({ value }) => shown.includes(value)).map(({ value, label }) => ({
      category: value as IssueCategory,
      label,
      // Array.sort is stable, so equally severe reports stay newest first
      reports: reports.filter((r) => r.category === value).sort((a, b) => (sort === 'gravity' ? byLevel(b) - byLevel(a) : 0)),
    })).filter((g) => categories.length || g.reports.length) // keep chosen categories even when empty
  }, [data, sort, categories])

  const job = data?.job
  const working = Boolean(job?.running)
  const counts = useMemo(() => {
    const result = { 3: 0, 2: 0, 1: 0 }
    for (const r of data?.reports ?? []) if (r.severity) result[r.severity.level] += 1
    return result
  }, [data])

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>Resident reports</Typography>
          <Typography variant="h2" component="h1">Reports</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            Every photo residents have sent in, tagged by what they reported. Pick the categories to show, then sort by gravity to have the council’s own AI model rank each one by how urgent it looks.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshRounded />} disabled={!data} onClick={reload} sx={{ bgcolor: 'background.paper' }}>
            Refresh
          </Button>
          {sort === 'gravity' && <Button disabled={working || !data?.reports.length} onClick={() => void start(true)}>Reassess all</Button>}
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, mb: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
        <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ width: 240 }}>
            <InputLabel id="report-categories-label" shrink>Categories</InputLabel>
            <Select<IssueCategory[]> labelId="report-categories-label" multiple displayEmpty value={categories}
              input={<OutlinedInput label="Categories" notched />}
              onChange={(e) => {
                const value = e.target.value
                const chosen = new Set(typeof value === 'string' ? value.split(',') : value)
                // Keep the dropdown's order, whatever order they were ticked in
                setParam('categories', CATEGORY_VALUES.filter((c) => chosen.has(c)).join(',') || null)
              }}
              renderValue={(chosen) => (chosen.length ? chosen.map(categoryLabel).join(', ') : 'All categories')}>
              {ISSUE_CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  <Checkbox size="small" checked={categories.includes(c.value)} sx={{ p: 0.5, mr: 1 }} />
                  <ListItemText primary={c.label} secondary={data ? `${data.reports.filter((r) => r.category === c.value).length} reports` : undefined} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup size="small" exclusive value={sort} aria-label="Sort reports"
            onChange={(_, value: Sort | null) => value && setParam('sort', value === 'newest' ? null : value)} sx={{ bgcolor: 'background.paper' }}>
            <ToggleButton value="newest">Newest</ToggleButton>
            <ToggleButton value="gravity"><AutoAwesomeOutlined sx={{ fontSize: 16, mr: 0.75 }} />Gravity</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 1 }} aria-label="Severity key">
          {([3, 2, 1] as SeverityLevel[]).map((level) => (
            <Stack key={level} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: SEVERITY[level].color }} />
              <Typography variant="caption" color="text.secondary">
                {level} · {SEVERITY[level].label}{data ? ` (${counts[level]})` : ''}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={reload}>Retry</Button>}>{error}</Alert>}
      {startError && <Alert severity="error" sx={{ mb: 2 }}>{startError}</Alert>}
      {job?.error && !working && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}
          action={<Button color="inherit" onClick={() => void start()}>Try again</Button>}>
          {job.error}
          {job.failed > 0 && ` (${job.failed} report${job.failed === 1 ? '' : 's'} failed)`}
        </Alert>
      )}
      {data && data.skipped.length > 0 && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2, bgcolor: 'background.paper' }}>
          Couldn’t read {data.skipped.length === 1 ? 'this file' : 'these files'} in the photo folder as JPEG, PNG or WebP photos under 10 MB: {data.skipped.join(', ')}
        </Alert>
      )}

      {working && job && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }} role="status">
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <AutoAwesomeOutlined sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {job.total ? `Assessing ${Math.min(job.done + 1, job.total)} of ${job.total}` : 'Starting assessment'}
                {job.current && `: ${job.current}`}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">Reports move up as each one is assessed</Typography>
          </Stack>
          <LinearProgress variant={job.total ? 'determinate' : 'indeterminate'} value={job.total ? (job.done / job.total) * 100 : 0}
            sx={{ mt: 1.5, height: 6, borderRadius: 3 }} />
        </Paper>
      )}

      {!data && !error && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 2 }}>
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '4 / 3', height: 'auto' }} />)}
        </Box>
      )}
      {data && !data.reports.length && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>No reports yet</Typography>
          <Typography color="text.secondary">Photos residents send from the app’s Report tab will appear here.</Typography>
        </Paper>
      )}

      {data && (groups
        ? <Stack spacing={4}>
            {groups.map((g) => (
              <Box component="section" key={g.category} aria-labelledby={`reports-${g.category}`}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1.5 }}>
                  <Typography id={`reports-${g.category}`} variant="h6" component="h2">{g.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{g.reports.length}</Typography>
                </Stack>
                {g.reports.length
                  ? <Gallery reports={g.reports} onOpen={(id) => setParam('report', String(id))} />
                  : <Typography color="text.secondary">No {g.label.toLowerCase()} reports yet.</Typography>}
              </Box>
            ))}
          </Stack>
        : <Gallery reports={data.reports} onOpen={(id) => setParam('report', String(id))} />)}

      {data && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4, overflowWrap: 'anywhere' }}>
          To add photos by hand, put them in a category’s subfolder of <Box component="code">{data.folder}</Box> and press Refresh.
        </Typography>
      )}

      <ReportDialog report={selected} onClose={() => setParam('report', null)} />
    </Box>
  )
}
