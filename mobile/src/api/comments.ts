import { api } from './client';
import type { Vote } from './events';

export type EventComment = {
  id: number;
  event_id: number;
  body: string;
  user_email: string | null;
  likes: number;
  dislikes: number;
  my_vote: Vote;
  is_mine: boolean;
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

export async function postComment(eventId: number, body: string) {
  const { data } = await api.post<EventComment>(`/events/${eventId}/comments`, { body: body.trim() });
  return data;
}
