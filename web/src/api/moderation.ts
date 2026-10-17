import { api } from './client'
import type { RecentComment } from './overview'

/** A comment residents reported. The app hides it until an admin keeps or deletes it. */
export interface FlaggedComment extends RecentComment {
  parent_id: number | null
  flags: number // how many people reported it
  reasons: string[] // only the reports that gave one
  first_flagged_at: string // SQLite UTC timestamp, "YYYY-MM-DD HH:MM:SS"
}

export async function fetchFlaggedComments(signal?: AbortSignal): Promise<FlaggedComment[]> {
  const { data } = await api.get<FlaggedComment[]>('/admin/flagged-comments', { signal })
  return data
}

/** Puts a reported comment back in the app. Deleting it is `deleteComment` in ./events. */
export async function approveComment(commentId: number): Promise<void> {
  await api.post(`/admin/comments/${commentId}/approve`)
}
