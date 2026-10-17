import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { TypeCount } from '../../api/insights'
import { formatNumber } from '../../utils/format'
import { percent, stanceColor, stanceCounts, STANCES, voteColors } from './stance'

interface Segment {
  key: string
  label: string
  value: number
  color: string
}

/**
 * A 100% stacked bar: 2px surface gaps between fills, rounded outer ends, and a tooltip
 * on every segment so exact numbers are a hover away.
 */
function SegmentBar({ segments, height, label }: { segments: Segment[]; height: number; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const shown = segments.filter((s) => s.value > 0)
  if (!total) {
    return <Box role="img" aria-label={`${label}: no data`} sx={{ height, borderRadius: 1, bgcolor: 'action.hover' }} />
  }
  return (
    <Box
      role="img"
      aria-label={`${label}: ${shown.map((s) => `${s.label} ${s.value} (${percent(s.value / total)})`).join(', ')}`}
      sx={{ display: 'flex', gap: '2px', height, width: '100%' }}
    >
      {shown.map((s, i) => (
        <Tooltip key={s.key} title={`${s.label}: ${formatNumber(s.value)} (${percent(s.value / total)})`} placement="top">
          <Box
            sx={{
              flexGrow: s.value,
              flexBasis: 0,
              minWidth: 3,
              bgcolor: s.color,
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === shown.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === shown.length - 1 ? 4 : 0,
              // A taller hit target than the mark itself
              position: 'relative',
              '&::after': { content: '""', position: 'absolute', inset: '-6px 0' },
              transition: 'opacity 120ms',
              '&:hover': { opacity: 0.85 },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  )
}

/** What the comments say, on the support → opposition scale. */
export function StanceBar({ types, height = 10, label = 'Comment mix' }: { types: TypeCount[]; height?: number; label?: string }) {
  const { mode } = useTheme().palette
  const segments = stanceCounts(types).map((s) => ({ key: s.key, label: s.label, value: s.count, color: stanceColor(mode, s.key) }))
  return <SegmentBar segments={segments} height={height} label={label} />
}

/** Likes against dislikes, in the scale's two pole colours. */
export function VoteBar({ likes, dislikes, height = 8 }: { likes: number; dislikes: number; height?: number }) {
  const colors = voteColors(useTheme().palette.mode)
  return (
    <SegmentBar
      label="Votes"
      height={height}
      segments={[
        { key: 'likes', label: 'Likes', value: likes, color: colors.likes },
        { key: 'dislikes', label: 'Dislikes', value: dislikes, color: colors.dislikes },
      ]}
    />
  )
}

/** The legend for StanceBar; always shown wherever the bars are. */
export function StanceLegend() {
  const { mode } = useTheme().palette
  return (
    <Stack direction="row" component="ul" aria-label="Legend" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5, listStyle: 'none', m: 0, p: 0 }}>
      {STANCES.map((s) => (
        <Stack key={s.key} component="li" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: stanceColor(mode, s.key), flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">
            {s.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}
