import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined'
import ArrowForward from '@mui/icons-material/ArrowForwardRounded'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlineOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import type { AdminEvent } from '../../api/events'
import { eventDeadlineLabel } from '../../utils/eventDeadline'
import { formatNumber } from '../../utils/format'
import VoteCounts from './VoteCounts'

interface EventCardProps {
  event: AdminEvent
  isNew?: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

/** The app's feed card (title, description, deadline, votes, "View on map") with edit and delete. */
export default function EventCard({ event, isNew, onOpen, onEdit, onDelete }: EventCardProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`Open ${event.title} on the map`}
        sx={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          p: 1.5,
          pb: 0.5,
          '&:hover, &.Mui-focusVisible': { bgcolor: 'action.hover' },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {event.title}
          </Typography>
          {isNew && <Chip label="New" size="small" color="primary" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700 }} />}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {event.description}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.75, color: 'text.secondary' }}>
          <ScheduleOutlined sx={{ fontSize: 14 }} />
          <Typography variant="caption">{eventDeadlineLabel(event.closes_at)}</Typography>
        </Stack>
      </ButtonBase>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, px: 1.5, pb: 1, pt: 0.5, flexWrap: 'wrap' }}>
        <VoteCounts likes={event.likes} dislikes={event.dislikes} />
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary', ml: 1 }} aria-label={`${event.comments} comments`}>
          <ChatBubbleOutline sx={{ fontSize: 15 }} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {formatNumber(event.comments)}
          </Typography>
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Edit event">
          <IconButton size="small" aria-label={`Edit ${event.title}`} onClick={onEdit}>
            <EditOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete event">
          <IconButton size="small" aria-label={`Delete ${event.title}`} onClick={onDelete}>
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button size="small" endIcon={<ArrowForward />} onClick={onOpen} sx={{ fontWeight: 600 }}>
          View on map
        </Button>
      </Stack>
    </Paper>
  )
}
