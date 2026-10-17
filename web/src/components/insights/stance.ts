import type { PaletteMode } from '@mui/material/styles'
import type { CommentType, TypeCount } from '../../api/insights'

/**
 * Comment types folded onto one diverging scale, support (blue) to opposition (red),
 * with a gray midpoint. Each arm was validated as a monotone ramp in both modes; on the
 * dark surface the stronger step is the lighter one.
 */
export type Stance = 'support' | 'suggestion' | 'neutral' | 'concern' | 'oppose'

export const STANCES: { key: Stance; label: string; types: CommentType[] }[] = [
  { key: 'support', label: 'Support', types: ['support'] },
  { key: 'suggestion', label: 'Suggestions', types: ['suggestion'] },
  { key: 'neutral', label: 'Questions, mixed & other', types: ['question', 'mixed', 'other'] },
  { key: 'concern', label: 'Concerns', types: ['concern'] },
  { key: 'oppose', label: 'Opposed', types: ['oppose'] },
]

const COLORS: Record<PaletteMode, Record<Stance, string>> = {
  light: { support: '#256abf', suggestion: '#86b6ef', neutral: '#d9d8d2', concern: '#f19a8f', oppose: '#d03b3b' },
  dark: { support: '#6da7ec', suggestion: '#256abf', neutral: '#4a4a46', concern: '#b43a3a', oppose: '#ec7a6e' },
}

export const stanceColor = (mode: PaletteMode, stance: Stance) => COLORS[mode][stance]
/** Likes and dislikes use the scale's two poles. */
export const voteColors = (mode: PaletteMode) => ({ likes: COLORS[mode].support, dislikes: COLORS[mode].oppose })

export const TYPE_LABELS: Record<CommentType, string> = {
  support: 'Supportive',
  oppose: 'Opposed',
  concern: 'Concerns',
  mixed: 'Mixed',
  suggestion: 'Suggestions',
  question: 'Questions',
  other: 'Other',
}

export function stanceCounts(types: TypeCount[]) {
  return STANCES.map((s) => ({
    ...s,
    count: types.filter((t) => s.types.includes(t.type)).reduce((sum, t) => sum + t.count, 0),
  }))
}

export const percent = (value: number) => `${Math.round(value * 100)}%`

/** SQLite's UTC "YYYY-MM-DD HH:MM:SS" as a local date and time. */
export const generatedAt = (timestamp: string) =>
  new Date(timestamp.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
