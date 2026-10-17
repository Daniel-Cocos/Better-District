import { useState, type ReactElement } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import LockOutlined from '@mui/icons-material/LockOutlined'
import TuneRounded from '@mui/icons-material/TuneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import type { StepProps } from './StepBasics'
import { tint } from '../../theme'

function ListCard({
  icon,
  title,
  hint,
  accent,
  soft,
  items,
  onChange,
}: {
  icon: ReactElement
  title: string
  hint: string
  accent: string
  soft: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const add = (text: string) => {
    if (!text.trim()) return
    onChange([...items, text.trim()])
    setDraft('')
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <Box
          sx={(t) => ({ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', ...tint(t, accent, soft) })}
        >
          {icon}
        </Box>
        <Typography component="h3" sx={{ fontWeight: 650 }}>
          {title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {hint}
      </Typography>

      <Stack component="ol" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, mb: items.length ? 2 : 0 }}>
        {items.map((item, i) => (
          <Stack
            component="li"
            key={i}
            direction="row"
            spacing={1}
            sx={(t) => ({ alignItems: 'flex-start', p: 1, pl: 1.5, borderRadius: 2, bgcolor: tint(t, accent, soft).bgcolor })}
          >
            <TextField
              variant="standard"
              multiline
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              onBlur={() => !item.trim() && onChange(items.filter((_, j) => j !== i))}
              slotProps={{ input: { disableUnderline: true }, htmlInput: { 'aria-label': `${title} ${i + 1}` } }}
              sx={{ flexGrow: 1, pt: 0.5, '& .MuiInputBase-root': { bgcolor: 'transparent' } }}
            />
            <IconButton size="small" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
        <TextField
          size="small"
          placeholder="Add an item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
          fullWidth
        />
        <Button variant="outlined" onClick={() => add(draft)} disabled={!draft.trim()} sx={{ py: 0.5, minWidth: 0, px: 1.5 }}>
          <AddRounded fontSize="small" />
        </Button>
      </Stack>
    </Paper>
  )
}

export default function StepTerms({ form, update }: StepProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <ListCard
        icon={<LockOutlined fontSize="small" />}
        title="What is permanent"
        hint="Already decided."
        accent="#5B6876"
        soft="#EEF0F3"
        items={form.permanent}
        onChange={(permanent) => update({ permanent })}
      />
      <ListCard
        icon={<TuneRounded fontSize="small" />}
        title="Your views can change this"
        hint="Open to residents’ feedback."
        accent="#2F8A87"
        soft="#E3F2F1"
        items={form.changeable}
        onChange={(changeable) => update({ changeable })}
      />
    </Box>
  )
}
