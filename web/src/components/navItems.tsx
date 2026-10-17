import type { ReactElement } from 'react'
import DashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined'
import MapOutlined from '@mui/icons-material/MapOutlined'
import CampaignOutlined from '@mui/icons-material/CampaignOutlined'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'

export const navItems: { to: string; label: string; icon: ReactElement }[] = [
  { to: '/', label: 'Overview', icon: <DashboardOutlined fontSize="small" /> },
  { to: '/map', label: 'City map', icon: <MapOutlined fontSize="small" /> },
  { to: '/proposals', label: 'Proposals', icon: <CampaignOutlined fontSize="small" /> },
  { to: '/projects', label: 'Projects', icon: <ConstructionOutlined fontSize="small" /> },
  { to: '/ideas', label: 'Ideas & interest areas', icon: <LightbulbOutlined fontSize="small" /> },
  { to: '/engagement', label: 'Engagement', icon: <ForumOutlined fontSize="small" /> },
]
