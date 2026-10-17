import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Box, Button, CircularProgress, List, ListItemButton, Stack, Typography } from '@mui/material'
import { errorMessage } from '../api/client'
import { useNotifications } from '../notifications/NotificationsContext'
import type { ReplyNotification } from '../api/notifications'

export default function Notifications() {
  const { items, loading, error, refresh, markRead } = useNotifications()
  const [readError, setReadError] = useState<string | null>(null)
  const navigate = useNavigate()
  async function open(item: ReplyNotification) {
    setReadError(null)
    try { await markRead(item.id) }
    catch (err) { setReadError(errorMessage(err, 'Couldn’t mark this notification as read. Please try again.')); return }
    navigate(`/map?event=${item.event_id}`)
  }
  return <Box sx={{ maxWidth: 760, mx: 'auto' }}>
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Typography variant="h2" component="h1">Notifications</Typography>
      <Button onClick={refresh} disabled={loading}>Refresh</Button>
    </Stack>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
    {readError && <Alert severity="error" sx={{ mb: 2 }}>{readError}</Alert>}
    {loading && !items.length && <CircularProgress size={28} aria-label="Loading notifications" />}
    {!loading && !error && !items.length && <Typography color="text.secondary">Replies to your comments will appear here.</Typography>}
    <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {items.map((item) => <Box component="li" key={item.id} sx={{ listStyle: 'none' }}>
        <ListItemButton onClick={() => void open(item)} sx={{ display: 'block', border: 1, borderRadius: 3,
          borderColor: item.is_read ? 'divider' : 'primary.main', bgcolor: 'background.paper', p: 2 }}>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
            {!item.is_read && '● '}{item.user_email ?? 'Anonymous'} replied to you
          </Typography>
          <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{item.event_title}</Typography>
          <Typography variant="body2" sx={{ my: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{item.body}</Typography>
          <Typography variant="caption" color="text.secondary">{new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</Typography>
        </ListItemButton>
      </Box>)}
    </List>
  </Box>
}
