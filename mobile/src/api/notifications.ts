import { api } from './client';

export type ReplyNotification = {
  id: number;
  comment_id: number;
  parent_id: number | null;
  event_id: number;
  event_title: string;
  body: string;
  user_email: string | null;
  created_at: string;
  is_read: boolean;
};

export async function listNotifications(signal?: AbortSignal) {
  const { data } = await api.get<ReplyNotification[]>('/users/me/notifications', { signal });
  return data;
}

export async function markNotificationRead(id: number) {
  await api.patch(`/users/me/notifications/${id}/read`);
}
