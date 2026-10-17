import { api } from './client'

export interface ReplyNotification {
  id: number
  comment_id: number
  parent_id: number | null
  event_id: number
  event_title: string
  body: string
  user_email: string | null
  created_at: string
  is_read: boolean
}

export async function fetchNotifications(signal?: AbortSignal): Promise<ReplyNotification[]> {
  const { data } = await api.get<ReplyNotification[]>('/admin/notifications', { signal })
  return data
}

export async function markNotificationRead(id: number) {
  await api.patch(`/admin/notifications/${id}/read`)
}
