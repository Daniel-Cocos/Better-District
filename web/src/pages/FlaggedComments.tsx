import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CheckRounded from '@mui/icons-material/CheckRounded'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import MapOutlined from '@mui/icons-material/MapOutlined'
import { errorMessage } from '../api/client'
import type { FlaggedComment } from '../api/moderation'
import { useEventActions } from '../components/events/useEventActions'
import { useFlaggedComments } from '../moderation/FlaggedCommentsContext'

const reportedAt = (timestamp: string) => new Date(timestamp.replace(' ', 'T') + 'Z').toLocaleString()

/** Comments residents reported. Each is hidden from the app until it's kept or deleted here. */
export default function FlaggedComments() {
  const { items, error, refresh, approve } = useFlaggedComments()
  const actions = useEventActions({ onChanged: refresh })
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function keep(comment: FlaggedComment) {
    setBusyId(comment.id)
    setActionError(null)
    try {
      await approve(comment.id)
    } catch (err) {
      setActionError(errorMessage(err, 'Couldn’t keep this comment. Please try again.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h2" component="h1">
        Flagged comments
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Residents reported these as inappropriate, so the app hides them until you decide. Keep a comment to put it back,
        or delete it for good.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={refresh}>Retry</Button>}>
          {error}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {!items && !error && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} component="li" variant="rounded" height={160} />)}
        {items?.map((c) => (
          <Paper component="li" key={c.id} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="caption" color="primary" component="p" sx={{ fontWeight: 600 }}>
              On {c.event_title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {c.user_email ?? 'Anonymous'}
            </Typography>
            <Typography sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>{c.body}</Typography>

            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Reported by {c.flags} {c.flags === 1 ? 'person' : 'people'} · first on {reportedAt(c.first_flagged_at)}
              </Typography>
              {c.reasons.length > 0 && (
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                  {c.reasons.map((reason, i) => (
                    <Typography component="li" variant="body2" key={i} sx={{ overflowWrap: 'anywhere' }}>
                      {reason}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>

            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckRounded />}
                loading={busyId === c.id}
                disabled={busyId !== null}
                onClick={() => void keep(c)}
              >
                Keep comment
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutline />}
                disabled={busyId !== null}
                onClick={() => actions.removeComment(c)}
              >
                Delete comment
              </Button>
              <Button component={RouterLink} to={`/map?event=${c.event_id}`} startIcon={<MapOutlined />} sx={{ ml: 'auto' }}>
                View conversation
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {items?.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nothing to review. Comments residents report will appear here.
        </Typography>
      )}

      {actions.dialogs}
    </Box>
  )
}
