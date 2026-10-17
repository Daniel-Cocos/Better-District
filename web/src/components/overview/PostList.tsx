import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Skeleton from '@mui/material/Skeleton'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import type { Post, Stage } from '../../api/overview'
import { engagementMeta, stageMeta } from '../postMeta'
import { tint } from '../../theme'
import { daysUntil, formatNumber, relativeTime } from '../../utils/format'

const filters: { value: 'all' | Stage; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'live_trial', label: 'Live trials' },
  { value: 'built', label: 'Built' },
]

const columns = { xs: '1fr auto', md: 'minmax(0, 2.6fr) 1.3fr 1fr 0.8fr 1fr' }

function Timing({ post }: { post: Post }) {
  if (post.stage !== 'built' && post.closes_on) {
    const days = daysUntil(post.closes_on)
    const urgent = days <= 3
    return (
      <Typography variant="body2" sx={{ color: urgent ? 'error.main' : 'text.primary', fontWeight: urgent ? 600 : 400 }}>
        {days < 0 ? 'Closed' : days === 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`}
      </Typography>
    )
  }
  return (
    <Typography variant="body2" color="text.secondary">
      {post.updated_at ? `Updated ${relativeTime(post.updated_at)}` : '—'}
    </Typography>
  )
}

export default function PostList({ posts, loading }: { posts?: Post[]; loading?: boolean }) {
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all')
  const visible = posts?.filter((p) => filter === 'all' || p.stage === filter) ?? []

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, pt: 2.5 }}>
        <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem', fontWeight: 650 }}>
          Live posts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Everything residents can currently see, most recently active first
        </Typography>
      </Box>

      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{ px: 1.5, mt: 1, minHeight: 44, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 44, px: 1.5, minWidth: 0 } }}
      >
        {filters.map((f) => (
          <Tab key={f.value} value={f.value} label={f.label} />
        ))}
      </Tabs>

      {/* Column headings (desktop) */}
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: columns.md,
          gap: 2,
          px: 2.5,
          py: 1.25,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
          '& > *': { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' },
        }}
      >
        <span>Post</span>
        <span>Status</span>
        <span>Engagement</span>
        <span>Responses</span>
        <span>Timing</span>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {loading &&
          Array.from({ length: 5 }, (_, i) => (
            <Box key={i} component="li" sx={{ px: 2.5, py: 1.75, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
              <Skeleton width="40%" />
              <Skeleton width="20%" />
            </Box>
          ))}

        {visible.map((p, i) => {
          const status = stageMeta[p.stage]
          return (
            <Box
              component="li"
              key={p.id}
              sx={(t) => ({
                display: 'grid',
                gridTemplateColumns: columns,
                gap: { xs: 1.5, md: 2 },
                alignItems: 'center',
                px: 2.5,
                py: 1.75,
                borderTop: i ? 1 : 0,
                borderColor: 'divider',
                transition: t.transitions.create('background-color', { duration: 120 }),
                '&:hover': { bgcolor: 'background.default' },
              })}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {p.title}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary', mt: 0.25 }}>
                  <PlaceOutlined sx={{ fontSize: 14 }} />
                  <Typography variant="caption" noWrap>
                    {p.ward ?? 'No ward set'}
                    {/* On small screens the other columns collapse into this line */}
                    <Box component="span" sx={{ display: { md: 'none' } }}>
                      {' · '}
                      {formatNumber(p.responses)} responses
                    </Box>
                  </Typography>
                </Stack>
              </Box>

              <Box>
                <Chip
                  size="small"
                  label={status.label}
                  sx={(t) => ({ ...tint(t, status.color, status.soft), fontWeight: 600, borderRadius: 1.5 })}
                />
              </Box>

              <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, color: 'text.secondary' }}>
                {p.engagement.map((e) => (
                  <Tooltip key={e} title={engagementMeta[e].label}>
                    <Box sx={{ display: 'flex' }} aria-label={engagementMeta[e].label}>
                      {engagementMeta[e].icon}
                    </Box>
                  </Tooltip>
                ))}
              </Stack>

              <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(p.responses)}
              </Typography>

              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Timing post={p} />
              </Box>
            </Box>
          )
        })}

        {!loading && visible.length === 0 && (
          <Typography component="li" variant="body2" color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>
            Nothing here yet.
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
