import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import type { LiveStatus } from '../../api/events'

const liveLabel: Record<LiveStatus, { text: string; color: string; hint: string }> = {
  live: { text: 'Live', color: '#2E9D5B', hint: 'Residents’ votes and comments appear as they happen.' },
  connecting: { text: 'Connecting…', color: '#8A94A0', hint: 'Starting live updates.' },
  reconnecting: { text: 'Reconnecting…', color: '#C98A1B', hint: 'Live updates paused; retrying automatically.' },
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' })

export default function LiveIndicator({ status, updatedAt }: { status: LiveStatus; updatedAt: Date | null }) {
  const { text, color, hint } = liveLabel[status]
  return (
    <Tooltip title={`${hint}${updatedAt ? ` Last updated ${timeFormat.format(updatedAt)}.` : ''}`}>
      <Stack
        direction="row"
        spacing={0.75}
        role="status"
        aria-live="polite"
        sx={{ alignItems: 'center', px: 1.25, py: 0.5, borderRadius: 99, bgcolor: alpha(color, 0.12), flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: color,
            boxShadow: status === 'live' ? `0 0 0 3px ${alpha(color, 0.25)}` : 'none',
          }}
        />
        <Typography variant="caption" sx={{ fontWeight: 600, color }}>
          {text}
        </Typography>
      </Stack>
    </Tooltip>
  )
}
