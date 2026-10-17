import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ChevronRight from '@mui/icons-material/ChevronRightRounded'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import type { Briefing } from '../../api/insights'
import { UrgencyChip } from './Chips'
import { generatedAt } from './stance'

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', mt: 3, mb: 1, lineHeight: 1.5 }}>
      {children}
    </Typography>
  )
}

interface BriefingCardProps {
  briefing: Briefing | null
  /** True while a run that will write the briefing is going */
  working: boolean
  onOpenPlan: (eventId: number) => void
}

/** The model's city-wide reading: the headline, where to pivot first, and what works. */
export default function BriefingCard({ briefing, working, onOpenPlan }: BriefingCardProps) {
  return (
    <Paper variant="outlined" component="section" aria-label="Council briefing" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <AutoAwesomeOutlined sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="body2" sx={{ fontWeight: 650 }}>Council briefing</Typography>
        {briefing && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto !important' }}>
            {briefing.model} · {generatedAt(briefing.generated_at)} · {briefing.plans} plans
          </Typography>
        )}
      </Stack>

      {!briefing ? (
        working ? (
          <Box sx={{ mt: 2 }}>
            <Skeleton width="80%" height={36} />
            <Skeleton width="95%" />
            <Skeleton width="90%" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              The briefing is written once every plan has been analysed.
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No briefing yet. Refresh the analysis to write one.
          </Typography>
        )
      ) : (
        <>
          {briefing.stale && (
            <Typography variant="caption" color="warning.main" component="p" sx={{ mt: 1 }}>
              Feedback has changed since this was written{working ? '; an update is on its way.' : '.'}
            </Typography>
          )}
          <Typography component="p" sx={{ fontSize: '1.25rem', fontWeight: 650, mt: 1.5, lineHeight: 1.4 }}>
            {briefing.headline}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.65 }}>
            {briefing.overview}
          </Typography>

          {briefing.priorities.length > 0 && (
            <>
              <Heading>Where to pivot first</Heading>
              <Stack component="ol" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {briefing.priorities.map((p, i) => (
                  <li key={p.event_id}>
                    <ButtonBase
                      onClick={() => onOpenPlan(p.event_id)}
                      sx={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5,
                        border: 1, borderColor: 'divider', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Typography sx={{ fontWeight: 700, color: 'text.secondary', width: 18, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {i + 1}
                      </Typography>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <UrgencyChip urgency={p.urgency} />
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>{p.title}</Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>{p.action}</Typography>
                        {p.why && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{p.why}</Typography>}
                      </Box>
                      <ChevronRight fontSize="small" sx={{ color: 'text.secondary', alignSelf: 'center', flexShrink: 0 }} />
                    </ButtonBase>
                  </li>
                ))}
              </Stack>
            </>
          )}

          {briefing.working_well.length > 0 && (
            <>
              <Heading>Working well</Heading>
              <Stack spacing={1}>
                {briefing.working_well.map((w) => (
                  <ButtonBase key={w.event_id} onClick={() => onOpenPlan(w.event_id)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', gap: 1.25, p: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                    <ThumbUpOutlined sx={{ fontSize: 16, color: 'success.main', mt: 0.25, alignSelf: 'flex-start' }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{w.title}</Typography>
                      {w.note && <Typography variant="body2" color="text.secondary">{w.note}</Typography>}
                    </Box>
                  </ButtonBase>
                ))}
              </Stack>
            </>
          )}
        </>
      )}
    </Paper>
  )
}
