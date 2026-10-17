import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import CloseRounded from '@mui/icons-material/CloseRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import { errorMessage } from '../../api/client'
import { reanalysePlan, type InsightPlan } from '../../api/insights'
import { eventDeadlineLabel } from '../../utils/eventDeadline'
import { formatNumber } from '../../utils/format'
import { AttentionChip, SentimentChip, UrgencyChip, VerdictChip } from './Chips'
import { StanceBar, StanceLegend, VoteBar } from './Bars'
import { generatedAt, percent, stanceColor, STANCES, TYPE_LABELS } from './stance'

const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 3 }}>
      <Typography variant="overline" color="text.secondary" component="h3" sx={{ lineHeight: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

/** Everything about one plan's feedback: the numbers, the model's reading, and what to change. */
export default function PlanDetail({ plan, onClose, onChanged }: { plan: InsightPlan; onClose: () => void; onChanged: () => void }) {
  const { mode } = useTheme().palette
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const a = plan.analysis
  const votes = plan.likes + plan.dislikes

  async function reanalyse() {
    setBusy(true)
    setError(null)
    try {
      await reanalysePlan(plan.id)
      onChanged()
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t analyse this plan.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: 3, pt: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {plan.is_open ? 'Open for feedback' : 'Closed'} · {eventDeadlineLabel(plan.closes_at)}
          </Typography>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 650, lineHeight: 1.3, mt: 0.5 }}>
            {plan.title}
          </Typography>
        </Box>
        <IconButton aria-label="Close plan details" onClick={onClose} sx={{ mr: -1 }}>
          <CloseRounded />
        </IconButton>
      </Stack>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
        <AttentionChip level={plan.attention.level} />
        {a && <VerdictChip verdict={a.verdict} />}
      </Stack>
      {plan.attention.reasons.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
          {plan.attention.reasons.map((r) => (
            <Typography component="li" variant="body2" color="text.secondary" key={r}>{r}</Typography>
          ))}
        </Box>
      )}

      <Section title="Votes">
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 650, lineHeight: 1 }}>
            {plan.approval === null ? '–' : percent(plan.approval)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {votes ? `approve · ${plural(plan.likes, 'like')}, ${plural(plan.dislikes, 'dislike')}` : 'No votes yet'}
          </Typography>
        </Stack>
        {votes > 0 && <Box sx={{ mt: 1 }}><VoteBar likes={plan.likes} dislikes={plan.dislikes} /></Box>}
      </Section>

      {error && <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>{error}</Alert>}

      {!a ? (
        <Section title="What the comments say">
          <Typography variant="body2" color="text.secondary">
            {plan.comments ? 'Not analysed yet. It will be included in the next run.' : 'No comments yet.'}
          </Typography>
        </Section>
      ) : (
        <>
          <Section title="What the comments say">
            {a.stale && (
              <Typography variant="caption" color="warning.main" component="p" sx={{ mb: 0.5 }}>
                New comments since this was written. Refresh the page’s analysis to update it.
              </Typography>
            )}
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{a.summary}</Typography>
          </Section>

          {a.pivots.length > 0 && (
            <Section title="Recommended changes">
              <Stack component="ol" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {a.pivots.map((p, i) => (
                  <Box component="li" key={i} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                      <UrgencyChip urgency={p.priority} priority />
                      {p.count > 0 && <Typography variant="caption" color="text.secondary">{plural(p.count, 'comment')}</Typography>}
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.action}</Typography>
                    {p.reason && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{p.reason}</Typography>}
                  </Box>
                ))}
              </Stack>
            </Section>
          )}

          <Section title={`Comment mix · ${plural(a.classified, 'comment')}`}>
            <StanceBar types={a.types} height={12} />
            <Box sx={{ mt: 1 }}><StanceLegend /></Box>
            {/* The exact numbers, as a table view of the bar */}
            <Box component="table" sx={{ width: '100%', mt: 1.5, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums',
              '& td, & th': { py: 0.5, borderTop: 1, borderColor: 'divider', typography: 'body2' }, '& th': { fontWeight: 400, textAlign: 'left', color: 'text.secondary' } }}>
              <tbody>
                {STANCES.flatMap((s) => s.types).map((type) => {
                  const entry = a.types.find((t) => t.type === type)
                  if (!entry) return null
                  const stance = STANCES.find((s) => s.types.includes(type))!.key
                  return (
                    <tr key={type}>
                      <th scope="row">
                        <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', mr: 1, bgcolor: stanceColor(mode, stance) }} />
                        {TYPE_LABELS[type]}
                      </th>
                      <td style={{ textAlign: 'right' }}>{entry.count}</td>
                      <td style={{ textAlign: 'right', width: 56 }}>{percent(entry.count / Math.max(a.classified, 1))}</td>
                      <Tooltip title="Likes those comments received from other residents">
                        <td style={{ textAlign: 'right', width: 88 }}>{plural(entry.likes, 'like')}</td>
                      </Tooltip>
                    </tr>
                  )
                })}
              </tbody>
            </Box>
          </Section>

          {a.themes.length > 0 && (
            <Section title="Themes">
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {a.themes.map((t) => <SentimentChip key={t.label} sentiment={t.sentiment} label={`${t.label} · ${t.count}`} />)}
              </Stack>
            </Section>
          )}

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
            Analysed by {a.model} on {generatedAt(a.generated_at)}
            {a.analysed < plan.comments && ` · latest ${formatNumber(a.analysed)} of ${formatNumber(plan.comments)} comments`}
          </Typography>
        </>
      )}

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 3 }}>
        <Button component={RouterLink} to={`/map?event=${plan.id}`} variant="outlined" startIcon={<MapOutlined />}>
          Open on map
        </Button>
        {plan.comments > 0 && (
          <Button startIcon={<RefreshRounded />} onClick={() => void reanalyse()} loading={busy}>
            Re-analyse
          </Button>
        )}
      </Stack>
    </Box>
  )
}
