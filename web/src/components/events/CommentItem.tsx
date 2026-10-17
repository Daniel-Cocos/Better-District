import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import type { EventComment } from '../../api/events'
import VoteCounts from './VoteCounts'

interface CommentItemProps {
  comment: Pick<EventComment, 'body' | 'user_email' | 'likes' | 'dislikes'>
  onDelete: () => void
  /** Shown above the author, e.g. the event the comment belongs to */
  context?: string
}

/** One comment as the app shows it (author, text, votes), with a moderator's delete button. */
export default function CommentItem({ comment, onDelete, context }: CommentItemProps) {
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
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        {context && (
          <Typography variant="caption" color="primary" component="p" noWrap sx={{ fontWeight: 600 }}>
            {context}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ fontWeight: 600 }}>
          {comment.user_email ?? 'Anonymous'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
          {comment.body}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
          <VoteCounts likes={comment.likes} dislikes={comment.dislikes} />
          <Tooltip title="Delete comment">
            <IconButton size="small" aria-label="Delete comment" onClick={onDelete} sx={{ mr: -0.75 }}>
              <DeleteOutline sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Stack>
  )
}
