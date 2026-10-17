import { api } from './client';
import type { Vote } from './events';

export type EventComment = {
  id: number;
  parent_id?: number | null;
  event_id: number;
  body: string;
  user_email: string | null;
  likes: number;
  dislikes: number;
  my_vote: Vote;
  is_mine: boolean;
  /** Reported as inappropriate: hidden from everyone else until the council reviews it */
  under_review?: boolean;
};

export type CommentHistory = EventComment & { event_title: string };

export async function listMyComments(signal?: AbortSignal) {
  const { data } = await api.get<CommentHistory[]>('/users/me/comments', { signal });
  return data;
}

export async function editComment(eventId: number, commentId: number, body: string) {
  const { data } = await api.patch<EventComment>(`/events/${eventId}/comments/${commentId}`, { body: body.trim() });
  return data;
}

export async function deleteComment(eventId: number, commentId: number) {
  await api.delete(`/events/${eventId}/comments/${commentId}`);
}

export async function listComments(eventId: number, signal?: AbortSignal) {
  const { data } = await api.get<EventComment[]>(`/events/${eventId}/comments`, { signal });
  return data;
}

export async function voteComment(eventId: number, commentId: number, vote: Vote) {
  const { data } = await api.put<EventComment>(`/events/${eventId}/comments/${commentId}/vote`, { vote });
  return data;
}

/** Report a comment as inappropriate; the app hides it until the council reviews it. */
export async function flagComment(eventId: number, commentId: number, reason = '') {
  await api.post(`/events/${eventId}/comments/${commentId}/flag`, { reason });
}

export async function postComment(eventId: number, body: string, parentId?: number) {
  const { data } = await api.post<EventComment>(`/events/${eventId}/comments`, { body: body.trim(), parent_id: parentId });
  return data;
}
