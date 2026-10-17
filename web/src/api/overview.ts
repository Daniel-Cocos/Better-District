import { api } from './client'

export type Stage = 'proposal' | 'live_trial' | 'built'
export type EngagementMode = 'comments' | 'threads' | 'poll' | 'survey'

export interface SiteLocation {
  latitude: number
  longitude: number
  radius_m: number
}

export interface Post {
  id: number // event id
  title: string
  ward: string | null
  location: SiteLocation
  stage: Stage
  engagement: EngagementMode[]
  responses: number // comments + likes + dislikes
  closes_on: string | null // ISO date
  updated_at: string | null // null for events posted outside the admin site
}

export interface RecentComment {
  id: number
  event_id: number
  event_title: string
  body: string
  user_email: string | null
}

export interface DraftSummary {
  id: number
  title: string
  updated_at: string
}

export interface OverviewStats {
  open_consultations: number
  live_trials: number
  completed: number
  drafts: number
  comments: number
  reactions: number
}

export interface Overview {
  stats: OverviewStats
  posts: Post[]
  recent_comments: RecentComment[]
  drafts: DraftSummary[]
}

export async function fetchOverview(signal?: AbortSignal): Promise<Overview> {
  const { data } = await api.get<Overview>('/admin/overview', { signal })
  return data
}
