import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import type { ReactElement } from 'react'
import DashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import MapOutlined from '@mui/icons-material/MapOutlined'
import FormatListBulleted from '@mui/icons-material/FormatListBulletedRounded'

/** Map and Feed mirror the app's tabs of the same names; Overview sums them up. */
export const navItems: { to: string; label: string; icon: ReactElement }[] = [
  { to: '/', label: 'Overview', icon: <DashboardOutlined fontSize="small" /> },
  { to: '/insights', label: 'Insights', icon: <InsightsOutlined fontSize="small" /> },
  { to: '/map', label: 'Map', icon: <MapOutlined fontSize="small" /> },
  { to: '/community', label: 'Community insights', icon: <LightbulbOutlined fontSize="small" /> },
  { to: '/flagged', label: 'Flagged comments', icon: <FlagOutlined fontSize="small" /> },
  { to: '/notifications', label: 'Notifications', icon: <NotificationsOutlined fontSize="small" /> },
  { to: '/feed', label: 'Feed', icon: <FormatListBulleted fontSize="small" /> },
]
