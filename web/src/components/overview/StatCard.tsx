import type { ReactElement, ReactNode } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import { tint } from '../../theme'

interface StatCardProps {
  label: string
  value?: string
  icon: ReactElement
  accent: string
  soft: string
  footer?: ReactNode
  loading?: boolean
}

export default function StatCard({ label, value, icon, accent, soft, footer, loading }: StatCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Box
          sx={(t) => ({
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            ...tint(t, accent, soft),
            '& svg': { fontSize: 19 },
          })}
        >
          {icon}
        </Box>
      </Stack>
      <Typography sx={{ fontSize: '1.875rem', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {loading ? <Skeleton width={72} /> : value}
      </Typography>
      {footer && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          {loading ? <Skeleton width="70%" /> : footer}
        </Typography>
      )}
    </Paper>
  )
}
