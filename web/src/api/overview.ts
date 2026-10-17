import { api } from './client'

export interface OverviewStats {
  events: number
  open_events: number
  comments: number
  likes: number
  dislikes: number
  residents: number // app accounts; anonymous guests aren't counted
  flagged_comments: number // hidden from the app until reviewed
}

export interface RecentComment {
  id: number
  event_id: number
  event_title: string
  body: string
  user_email: string | null
  likes: number
  dislikes: number
  under_review: boolean
}

export interface Overview {
  stats: OverviewStats
  recent_comments: RecentComment[]
}

export async function fetchOverview(signal?: AbortSignal): Promise<Overview> {
  const { data } = await api.get<Overview>('/admin/overview', { signal })
  return data
}
