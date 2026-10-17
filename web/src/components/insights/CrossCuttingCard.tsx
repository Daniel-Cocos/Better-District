import { useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Briefing } from '../../api/insights'
import { SentimentChip } from './Chips'

const SHOWN = 4

function Issue({ issue, onOpenPlan }: { issue: Briefing['cross_cutting'][number]; onOpenPlan: (id: number) => void }) {
  const [all, setAll] = useState(false)
  const events = all ? issue.events : issue.events.slice(0, SHOWN)
  const hidden = issue.events.length - events.length
  return (
    <Box component="li" sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <SentimentChip sentiment={issue.sentiment} label={issue.label} />
        <Typography variant="caption" color="text.secondary">
          {issue.events.length} plan{issue.events.length === 1 ? '' : 's'}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ mt: 1 }}>{issue.insight}</Typography>
      {events.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {events.map((e) => (
            <Chip key={e.event_id} size="small" label={e.title} onClick={() => onOpenPlan(e.event_id)} sx={{ maxWidth: '100%' }} />
          ))}
          {hidden > 0 && <Chip size="small" variant="outlined" label={`+${hidden} more`} onClick={() => setAll(true)} />}
        </Stack>
      )}
    </Box>
  )
}

/** Issues the briefing found running through several plans. */
export default function CrossCuttingCard({ briefing, onOpenPlan }: { briefing: Briefing; onOpenPlan: (id: number) => void }) {
  if (!briefing.cross_cutting.length) return null
  return (
    <Paper variant="outlined" component="section" aria-label="Issues across plans" sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 1, sm: 1.5 } }}>
      <Typography variant="body2" sx={{ fontWeight: 650 }}>Issues across plans</Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        Themes residents raise again and again, wherever they appear
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {briefing.cross_cutting.map((c) => <Issue key={c.label} issue={c} onOpenPlan={onOpenPlan} />)}
      </Box>
    </Paper>
  )
}
