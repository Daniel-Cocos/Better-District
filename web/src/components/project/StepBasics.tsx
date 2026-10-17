import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ButtonBase from '@mui/material/ButtonBase'
import { alpha } from '@mui/material/styles'
import CheckCircle from '@mui/icons-material/CheckCircleRounded'
import type { ProjectForm } from '../../api/projects'
import { stageMeta, stageOrder } from '../postMeta'
import FieldGroup from './FieldGroup'
import type { Errors } from './validation'

interface StepProps {
  form: ProjectForm
  update: (patch: Partial<ProjectForm>) => void
  errors: Errors
}

export default function StepBasics({ form, update, errors }: StepProps) {
  return (
    <Stack spacing={4}>
      <TextField
        label="Project title"
        value={form.title}
        onChange={(e) => update({ title: e.target.value })}
        error={Boolean(errors.title)}
        helperText={errors.title}
        slotProps={{ htmlInput: { maxLength: 200 } }}
        fullWidth
        autoFocus
      />

      <FieldGroup title="Stage">
        <Box
          role="radiogroup"
          aria-label="Stage"
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}
        >
          {stageOrder.map((stage) => {
            const meta = stageMeta[stage]
            const selected = form.stage === stage
            return (
              <ButtonBase
                key={stage}
                role="radio"
                aria-checked={selected}
                onClick={() => update({ stage })}
                sx={{
                  position: 'relative',
                  display: 'block',
                  textAlign: 'left',
                  p: 2,
                  borderRadius: 3,
                  border: 1.5,
                  borderColor: selected ? meta.color : 'divider',
                  bgcolor: selected ? alpha(meta.color, 0.06) : 'background.paper',
                  transition: 'border-color 120ms, background-color 120ms',
                  '&:hover': { borderColor: selected ? meta.color : alpha(meta.color, 0.5) },
                  '&.Mui-focusVisible': { outline: `3px solid ${alpha(meta.color, 0.3)}` },
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
                  <Typography sx={{ fontWeight: 650 }}>{meta.label}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ pr: 2 }}>
                  {meta.description}
                </Typography>
                {selected && (
                  <CheckCircle sx={{ position: 'absolute', top: 12, right: 12, fontSize: 20, color: meta.color }} />
                )}
              </ButtonBase>
            )
          })}
        </Box>
      </FieldGroup>

      <FieldGroup title="Feedback dates" hint="Optional.">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Opens"
            type="date"
            value={form.feedback_opens ?? ''}
            onChange={(e) => update({ feedback_opens: e.target.value || null })}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Closes"
            type="date"
            value={form.feedback_closes ?? ''}
            onChange={(e) => update({ feedback_closes: e.target.value || null })}
            error={Boolean(errors.feedback_closes)}
            helperText={errors.feedback_closes}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: form.feedback_opens ?? undefined } }}
            fullWidth
          />
        </Stack>
      </FieldGroup>

      <FieldGroup title="Responsible team and contact">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Team"
            value={form.team}
            onChange={(e) => update({ team: e.target.value })}
            error={Boolean(errors.team)}
            helperText={errors.team}
            fullWidth
          />
          <TextField
            label="Contact"
            value={form.contact}
            onChange={(e) => update({ contact: e.target.value })}
            error={Boolean(errors.contact)}
            helperText={errors.contact}
            fullWidth
          />
        </Stack>
      </FieldGroup>
    </Stack>
  )
}

export type { StepProps }
