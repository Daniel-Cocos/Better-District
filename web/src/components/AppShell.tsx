import Badge from '@mui/material/Badge'
import { useNotifications } from '../notifications/NotificationsContext'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/MenuRounded'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import { useAuth } from '../auth/AuthContext'
import { navItems } from './navItems'
import ThemeToggle from './ThemeToggle'

const DRAWER_WIDTH = 252

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { items } = useNotifications()
  const unread = items.filter((item) => !item.is_read).length
  const navButton = (item: (typeof navItems)[number]) => (
    <ListItemButton
      key={item.to}
      component={NavLink}
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      sx={(t) => ({
        borderRadius: 2,
        mb: 0.5,
        py: 0.9,
        color: 'text.secondary',
        '& .MuiListItemIcon-root': { minWidth: 36, color: 'inherit' },
        '&:hover': { bgcolor: alpha(t.palette.primary.main, 0.06), color: 'text.primary' },
        '&.active': {
          bgcolor: 'primary.light',
          color: 'primary.main',
          '& .MuiListItemText-primary': { fontWeight: 600 },
        },
      })}
    >
      <ListItemIcon><Badge badgeContent={item.to === '/notifications' ? unread : 0} color="primary">{item.icon}</Badge></ListItemIcon>
      <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body2', noWrap: true } }} />
    </ListItemButton>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 2, py: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 1, mb: 4 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <PlaceOutlined fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1.25 }}>
            Southampton City Council
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">
            Better District admin
          </Typography>
        </Box>
      </Stack>

      <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, fontSize: '0.68rem' }}>
        Manage
      </Typography>
      <List disablePadding component="nav" aria-label="Main">
        {navItems.map(navButton)}
      </List>

    </Box>
  )
}

export default function AppShell() {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const { pathname } = useLocation()
  const current = navItems.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  return (
    <Box sx={{ display: 'flex', minHeight: '100%', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' },
          }}
        >
          <SidebarContent />
        </Drawer>
      </Box>

      {/* Main column */}
      <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          component="header"
          sx={(t) => ({
            position: 'sticky',
            top: 0,
            zIndex: t.zIndex.appBar,
            height: 64,
            px: { xs: 2, sm: 3, lg: 4 },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: alpha(t.palette.background.default, 0.85),
            backdropFilter: 'blur(8px)',
            borderBottom: 1,
            borderColor: 'divider',
          })}
        >
          <IconButton
            edge="start"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }} noWrap>
            Admin portal{current && <Box component="span" sx={{ color: 'text.primary' }}> / {current.label}</Box>}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <ThemeToggle />
          <Tooltip title="Account">
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Account menu"
              aria-haspopup="menu"
              sx={{ p: 0.5 }}
            >
              <Avatar sx={{ width: 34, height: 34, fontSize: '0.85rem', fontWeight: 600, bgcolor: 'primary.main' }}>
                {user ? initials(user.name) : ''}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { mt: 1, minWidth: 220, border: 1, borderColor: 'divider' }, elevation: 0 } }}
          >
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={signOut} sx={{ mt: 0.5, gap: 1.5 }}>
              <LogoutOutlined fontSize="small" /> Sign out
            </MenuItem>
          </Menu>
        </Box>

        <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 3, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
