import { useEffect, useRef, useState, type FormEvent } from 'react'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import CloseRounded from '@mui/icons-material/CloseRounded'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import { errorMessage } from '../../api/client'
import { fetchComments, postComment, type AdminEvent, type EventComment } from '../../api/events'
import { eventDeadlineLabel } from '../../utils/eventDeadline'
import { useFlaggedComments } from '../../moderation/FlaggedCommentsContext'
import VoteCounts from './VoteCounts'
import CommentItem from './CommentItem'

interface EventPanelProps {
  event: AdminEvent
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onDeleteComment: (comment: EventComment) => void
}

/**
 * The app's event panel (title, description, deadline, votes, comments) with
 * moderation tools: edit or delete the event, and delete any comment.
 */
export default function EventPanel({ event, onClose, onEdit, onDelete, onDeleteComment }: EventPanelProps) {
  const [comments, setComments] = useState<EventComment[] | null>(null)
  const [replyTo, setReplyTo] = useState<EventComment | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const [error, setError] = useState<string | null>(null)
  const flagged = useFlaggedComments()
  const flaggedHere = flagged.items?.filter((c) => c.event_id === event.id).map((c) => c.id).join(',')
  const [approveError, setApproveError] = useState<string | null>(null)

  // Refetch when the live count moves, so residents' comments appear (and removed ones go),
  // and when reports here change, so flagged comments are marked
  useEffect(() => {
    const ctrl = new AbortController()
    fetchComments(event.id, ctrl.signal)
      .then((data) => {
        setComments(data)
        setError(null)
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(errorMessage(err, 'Couldn’t load comments.'))
      })
    return () => ctrl.abort()
  }, [event.id, event.comments, flaggedHere])

  async function keep(comment: EventComment) {
    setApproveError(null)
    try {
      await flagged.approve(comment.id)
      setComments((current) => current?.map((c) => (c.id === comment.id ? { ...c, under_review: false } : c)) ?? null)
    } catch (err) {
      setApproveError(errorMessage(err, 'Couldn’t keep this comment. Please try again.'))
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (sending || !draft.trim()) return
    setSending(true)
    setSendError(null)
    try {
      const comment = await postComment(event.id, draft, replyTo?.id)
      setComments((current) => [...(current ?? []).filter((item) => item.id !== comment.id), comment])
      setDraft('')
      setReplyTo(null)
    } catch (err) { setSendError(errorMessage(err, 'Couldn’t post your reply. Your draft is still here.')) }
    finally { setSending(false) }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" component="h2" sx={{ flexGrow: 1, fontWeight: 600, lineHeight: 1.4 }}>
          {event.title}
        </Typography>
        <IconButton aria-label="Close event details" onClick={onClose} sx={{ mt: -0.75, mr: -1 }}>
          <CloseRounded />
        </IconButton>
      </Stack>

      <Box sx={{ overflowY: 'auto', flexGrow: 1, minHeight: 0, p: 2 }}>
        <Stack spacing={1.5} sx={{ pb: 2, mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <DescriptionOutlined sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {event.description}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <ScheduleOutlined sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {eventDeadlineLabel(event.closes_at)}
            </Typography>
          </Stack>
          <VoteCounts likes={event.likes} dislikes={event.dislikes} />
          {/* Moderation tools: the only part that isn't in the app */}
          <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
            <Button size="small" variant="outlined" startIcon={<EditOutlined />} onClick={onEdit}>
              Edit
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutline />} onClick={onDelete}>
              Delete
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="warning" variant="outlined">
            {error}
          </Alert>
        )}
        {approveError && (
          <Alert severity="error" variant="outlined" onClose={() => setApproveError(null)}>
            {approveError}
          </Alert>
        )}
        {!comments && !error && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={72} />
          </Stack>
        )}
        {comments?.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No comments yet.
          </Typography>
        )}
        <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {comments?.map((c) => (
            <li key={c.id}>
              <CommentItem comment={c} onDelete={() => onDeleteComment(c)} onApprove={() => void keep(c)}
                replyTo={c.parent_id ? comments.find((parent) => parent.id === c.parent_id)?.user_email ?? 'Anonymous' : undefined}
                onReply={() => { setReplyTo(c); input.current?.focus() }} />
            </li>
          ))}
        </Stack>
      </Box>
      <Stack component="form" onSubmit={send} spacing={1} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        {replyTo && <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption">Replying to {replyTo.user_email ?? 'Anonymous'}</Typography>
          <Button size="small" disabled={sending} onClick={() => setReplyTo(null)}>Cancel reply</Button>
        </Stack>}
        {sendError && <Alert severity="error">{sendError}</Alert>}
        <TextField inputRef={input} label={replyTo ? 'Write a reply' : 'Add a comment'} multiline minRows={2} maxRows={5}
          value={draft} onChange={(e) => setDraft(e.target.value)} disabled={sending}
          slotProps={{ htmlInput: { maxLength: 5000 } }} />
        <Button type="submit" variant="contained" disabled={sending || !draft.trim() || !comments || Boolean(error)}>
          {sending ? 'Sending…' : replyTo ? 'Send reply' : 'Post comment'}
        </Button>
      </Stack>
    </Box>
  )
}
