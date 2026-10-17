import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ThumbUpOutlined from '@mui/icons-material/ThumbUpOutlined'
import ThumbDownOutlined from '@mui/icons-material/ThumbDownOutlined'
import { formatNumber } from '../../utils/format'

/** The app's like/dislike counts, read-only: admins see votes but don't cast them. */
export default function VoteCounts({ likes, dislikes }: { likes: number; dislikes: number }) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center', color: 'text.secondary' }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} aria-label={`${likes} likes`}>
        <ThumbUpOutlined sx={{ fontSize: 15 }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {formatNumber(likes)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }} aria-label={`${dislikes} dislikes`}>
        <ThumbDownOutlined sx={{ fontSize: 15 }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {formatNumber(dislikes)}
        </Typography>
      </Stack>
    </Stack>
  )
}
