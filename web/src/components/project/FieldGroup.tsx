import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

/** A labelled block inside a wizard step, mirroring the boxes in the sketch. */
export default function FieldGroup({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Box component="section">
      <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
        <Box>
          <Typography component="h3" sx={{ fontWeight: 650, fontSize: '0.95rem' }}>
            {title}
          </Typography>
          {hint && (
            <Typography variant="body2" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  )
}
