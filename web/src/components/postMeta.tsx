import type { ReactElement } from 'react'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlineOutlined'
import Forum from '@mui/icons-material/ForumOutlined'
import Poll from '@mui/icons-material/PollOutlined'
import Assignment from '@mui/icons-material/AssignmentOutlined'
import type { EngagementMode, Stage } from '../api/overview'

/** One place for stage labels and colours, shared by chips, map pins, legends and the wizard. */
export const stageMeta: Record<Stage, { label: string; description: string; color: string; soft: string }> = {
  proposal: {
    label: 'Proposal',
    description: 'An idea the council wants views on before deciding.',
    color: '#3E6FA8',
    soft: '#E6EEF8',
  },
  live_trial: {
    label: 'Live trial',
    description: 'Running on site for a set time, with feedback shaping what happens next.',
    color: '#2F8A87',
    soft: '#E3F2F1',
  },
  built: {
    label: 'Built',
    description: 'Finished and in place. Residents can still comment.',
    color: '#5E7A4B',
    soft: '#EBF1E6',
  },
}

export const stageOrder: Stage[] = ['proposal', 'live_trial', 'built']

export const engagementMeta: Record<EngagementMode, { label: string; icon: ReactElement }> = {
  comments: { label: 'Comments', icon: <ChatBubbleOutline sx={{ fontSize: 17 }} /> },
  threads: { label: 'Threads & replies', icon: <Forum sx={{ fontSize: 17 }} /> },
  poll: { label: 'Poll', icon: <Poll sx={{ fontSize: 17 }} /> },
  survey: { label: 'Survey', icon: <Assignment sx={{ fontSize: 17 }} /> },
}
