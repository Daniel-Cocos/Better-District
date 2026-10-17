import { useState, type FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { errorMessage } from '../../api/client'
import { createEvent, updateEvent, type AdminEvent } from '../../api/events'
import LocationPicker, { type LatLng } from './LocationPicker'

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO time -> the browser's local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** New events default to 5pm two weeks from today. */
function defaultDeadline() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  date.setHours(17, 0, 0, 0)
  return toLocalInput(date)
}

interface EventFormDialogProps {
  /** The event being edited, or null to add one */
  event: AdminEvent | null
  /** Where a new event's pin starts, e.g. the middle of the map being viewed */
  center: LatLng
  onClose: () => void
  onSaved: (event: AdminEvent, created: boolean) => void
}

/** Add or edit an event using exactly the fields residents see in the app. Remount (key) per event. */
export default function EventFormDialog({ event, center, onClose, onSaved }: EventFormDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [closes, setCloses] = useState(event?.closes_at ? toLocalInput(new Date(event.closes_at)) : defaultDeadline())
  const [location, setLocation] = useState<LatLng>(event ? [event.latitude, event.longitude] : center)
  const [errors, setErrors] = useState<{ title?: string; description?: string; closes?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [openedAt] = useState(() => Date.now())

  async function submit(e: FormEvent) {
    e.preventDefault()
    const deadline = new Date(closes)
    const next = {
      title: title.trim() ? undefined : 'Add a title',
      description: description.trim() ? undefined : 'Add a description',
      closes: closes && Number.isFinite(deadline.getTime()) ? undefined : 'Choose when it closes',
    }
    setErrors(next)
    if (next.title || next.description || next.closes) return

    setSaving(true)
    setFormError(null)
    const body = {
      title: title.trim(),
      description: description.trim(),
      latitude: location[0],
      longitude: location[1],
      closes_at: deadline.toISOString(),
    }
    try {
      const saved = event ? await updateEvent(event.id, body) : await createEvent(body)
      onSaved(saved, !event)
    } catch (err) {
      setFormError(errorMessage(err, 'Couldn’t save the event.'))
      setSaving(false)
    }
  }

  const closed = closes && new Date(closes).getTime() <= openedAt

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{event ? 'Edit event' : 'Add event'}</DialogTitle>
      <Box component="form" noValidate onSubmit={submit} sx={{ display: 'contents' }}>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            {event
              ? 'Changes appear in the app straight away. Votes and comments are kept.'
              : 'Residents see this in the app as soon as you publish it.'}
          </Typography>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title}
            required
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={Boolean(errors.description)}
            helperText={errors.description}
            required
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            slotProps={{ htmlInput: { maxLength: 10000 } }}
          />
          <TextField
            label="Closes / action due"
            type="datetime-local"
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
            error={Boolean(errors.closes)}
            helperText={errors.closes ?? (closed ? 'This is in the past, so the app will show it as closed.' : ' ')}
            required
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <LocationPicker value={location} onChange={setLocation} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={saving}>
          {event ? 'Save changes' : 'Publish'}
        </Button>
      </DialogActions>
      </Box>
    </Dialog>
  )
}
