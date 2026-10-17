import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlineOutlined'
import type { RecentComment } from '../../api/overview'

/** "alex@example.com" -> "alex"; anonymous comments show as "Resident". */
const author = (email: string | null) => (email ? email.split('@')[0] : 'Resident')

export default function ActivityFeed({ comments, loading }: { comments?: RecentComment[]; loading?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 650 }}>
        Latest comments
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        What residents are saying
      </Typography>

      <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {loading &&
          Array.from({ length: 5 }, (_, i) => (
            <Stack key={i} direction="row" spacing={1.5} sx={{ py: 1.25 }}>
              <Skeleton variant="rounded" width={32} height={32} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton width="85%" />
                <Skeleton width="45%" />
              </Box>
            </Stack>
          ))}

        {comments?.map((c, i) => (
          <Stack
            component="li"
            key={c.id}
            direction="row"
            spacing={1.5}
            sx={{ py: 1.25, borderTop: i ? 1 : 0, borderColor: 'divider' }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.light',
                color: 'primary.main',
              }}
            >
              <ChatBubbleOutline sx={{ fontSize: 17 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {author(c.user_email)}
                </Box>{' '}
                “{c.body}”
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p" noWrap>
                on {c.event_title}
              </Typography>
            </Box>
          </Stack>
        ))}

        {comments && comments.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No comments yet.
          </Typography>
        )}
      </Stack>
    </Paper>
  )
}
