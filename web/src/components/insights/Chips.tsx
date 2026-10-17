import Chip, { type ChipProps } from '@mui/material/Chip'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import SentimentSatisfiedAltOutlined from '@mui/icons-material/SentimentSatisfiedAltOutlined'
import SentimentDissatisfiedOutlined from '@mui/icons-material/SentimentDissatisfiedOutlined'
import SentimentNeutralOutlined from '@mui/icons-material/SentimentNeutralOutlined'
import type { InsightPlan, Priority, Sentiment, Verdict } from '../../api/insights'

// Status colours always come with an icon and a word, never colour alone
const LEVEL = {
  high: { icon: <ErrorOutlineRounded />, color: 'error' },
  medium: { icon: <WarningAmberRounded />, color: 'warning' },
  low: { icon: <CheckCircleOutlineRounded />, color: 'success' },
} as const

const small: Partial<ChipProps> = { size: 'small', variant: 'outlined' }

export function AttentionChip({ level }: { level: InsightPlan['attention']['level'] }) {
  const label = { high: 'Needs attention', medium: 'Worth watching', low: 'On track' }[level]
  return <Chip {...small} icon={LEVEL[level].icon} color={LEVEL[level].color} label={label} />
}

/** City-wide urgency, or (`priority`) how much a change matters within one plan. */
export function UrgencyChip({ urgency, priority = false }: { urgency: Priority; priority?: boolean }) {
  const label = priority
    ? { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }[urgency]
    : { high: 'Urgent', medium: 'Soon', low: 'When possible' }[urgency]
  return <Chip {...small} icon={LEVEL[urgency].icon} color={LEVEL[urgency].color} label={label} />
}

/** The model's own reading. Shown neutrally except "rethink": it says "adjust" for most plans. */
export function VerdictChip({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null
  const label = { on_track: 'AI: carry on', adjust: 'AI suggests changes', rethink: 'AI: rethink' }[verdict]
  if (verdict === 'rethink') return <Chip {...small} icon={LEVEL.high.icon} color="error" label={label} />
  return <Chip {...small} icon={<AutoAwesomeOutlined />} label={label} />
}

const SENTIMENT = {
  positive: { icon: <SentimentSatisfiedAltOutlined />, color: 'success' },
  negative: { icon: <SentimentDissatisfiedOutlined />, color: 'error' },
  mixed: { icon: <SentimentNeutralOutlined />, color: 'default' },
} as const

export function SentimentChip({ sentiment, label }: { sentiment: Sentiment; label: string }) {
  return (
    <Chip {...small} icon={SENTIMENT[sentiment].icon} color={SENTIMENT[sentiment].color} label={label}
      aria-label={`${label}, ${sentiment}`} />
  )
}
