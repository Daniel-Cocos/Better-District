import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import type { EventComment } from '../../api/events'
import VoteCounts from './VoteCounts'

interface CommentItemProps {
  comment: Pick<EventComment, 'body' | 'user_email' | 'likes' | 'dislikes'> & { under_review?: boolean }
  onDelete: () => void
  /** Keep a reported comment; only offered while it's under review */
  onApprove?: () => void
  /** Shown above the author, e.g. the event the comment belongs to */
  context?: string
  replyTo?: string
  onReply?: () => void
}

/**
 * One comment as the app shows it (author, text, votes), with a moderator's delete
 * button. Reported comments are marked, since residents can't see them until reviewed.
 */
export default function CommentItem({ comment, onDelete, onApprove, context, replyTo, onReply }: CommentItemProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: 'text.secondary',
        }}
      >
        <PersonOutlineOutlined sx={{ fontSize: 17 }} />
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: 1.5,
          border: 1,
          borderColor: comment.under_review ? 'warning.main' : 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        {comment.under_review && (
          <Chip
            icon={<FlagOutlined />}
            label="Reported · hidden from the app"
            size="small"
            color="warning"
            variant="outlined"
            sx={{ mb: 0.75 }}
          />
        )}
        {context && (
          <Typography variant="caption" color="primary" component="p" noWrap sx={{ fontWeight: 600 }}>
            {context}
          </Typography>
        )}
        {replyTo && <Typography variant="caption" color="text.secondary" component="p">Replying to {replyTo}</Typography>}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ fontWeight: 600 }}>
          {comment.user_email ?? 'Anonymous'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
          {comment.body}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
          <VoteCounts likes={comment.likes} dislikes={comment.dislikes} />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', ml: 'auto' }}>
            {comment.under_review && onApprove && (
              <Button size="small" color="success" onClick={onApprove}>
                Keep
              </Button>
            )}
            {onReply && !comment.under_review && <Button size="small" onClick={onReply}>Reply</Button>}
            <Tooltip title="Delete comment">
              <IconButton size="small" aria-label="Delete comment" onClick={onDelete} sx={{ mr: -0.75 }}>
                <DeleteOutline sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  )
}
