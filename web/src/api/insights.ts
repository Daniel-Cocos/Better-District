import { api } from './client'

export type CommentType = 'support' | 'oppose' | 'concern' | 'mixed' | 'suggestion' | 'question' | 'other'
export type Priority = 'high' | 'medium' | 'low'
export type Sentiment = 'positive' | 'negative' | 'mixed'
export type Verdict = 'on_track' | 'adjust' | 'rethink'

export interface TypeCount {
  type: CommentType
  count: number
  likes: number // likes those comments received, a rough measure of agreement
}

export interface PlanAnalysis {
  summary: string
  verdict: Verdict | null
  types: TypeCount[]
  themes: { label: string; sentiment: Sentiment; count: number }[]
  pivots: { action: string; reason: string; priority: Priority; count: number }[]
  analysed: number // comments sent to the model (the most recent, up to a limit)
  classified: number // of those, how many the model gave a type
  model: string
  generated_at: string // SQLite UTC timestamp, "YYYY-MM-DD HH:MM:SS"
  stale: boolean // comments have changed since it ran
}

export interface InsightPlan {
  id: number
  title: string
  closes_at: string | null
  is_open: boolean
  likes: number
  dislikes: number
  approval: number | null // likes / (likes + dislikes)
  comments: number
  analysis: PlanAnalysis | null
  attention: { level: 'low' | 'medium' | 'high'; reasons: string[] }
}

export interface PlanRef {
  event_id: number
  title: string
}

export interface Briefing {
  headline: string
  overview: string
  priorities: (PlanRef & { action: string; why: string; urgency: Priority })[]
  cross_cutting: { label: string; insight: string; sentiment: Sentiment; events: PlanRef[] }[]
  working_well: (PlanRef & { note: string })[]
  model: string
  plans: number
  generated_at: string
  stale: boolean
}

export interface InsightJob {
  running: boolean
  done: number
  total: number
  current: string | null
  error: string | null
  failed: number
}

export interface Insights {
  plans: InsightPlan[]
  totals: {
    plans: number
    analysed: number
    likes: number
    dislikes: number
    approval: number | null
    comments: number
    classified: number
    types: TypeCount[]
    high_attention: number
    medium_attention: number
  }
  briefing: Briefing | null
  job: InsightJob
  pending: number // plans whose analysis is missing or out of date
}

/** Everything the page shows; never waits for the model. */
export async function fetchInsights(signal?: AbortSignal): Promise<Insights> {
  const { data } = await api.get<Insights>('/admin/insights', { signal })
  return data
}

/** Starts analysing changed plans (or all of them with `force`) in the background. */
export async function refreshInsights(force = false): Promise<Insights> {
  const { data } = await api.post<Insights>('/admin/insights/refresh', null, { params: force ? { force: true } : undefined })
  return data
}

/** Re-runs one plan's analysis now and waits for it; a local model can take a minute. */
export async function reanalysePlan(eventId: number): Promise<void> {
  await api.post(`/admin/events/${eventId}/feedback/analyse`, null, { params: { force: true }, timeout: 330_000 })
}
