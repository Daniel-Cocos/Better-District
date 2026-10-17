import { api } from './client';

export type Vote = -1 | 0 | 1;

export type CouncilEvent = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  likes: number;
  dislikes: number;
  closes_at: string | null;
  my_vote: Vote;
};

export async function listEvents(): Promise<CouncilEvent[]> {
  const { data } = await api.get<CouncilEvent[]>('/events');
  return data;
}

export async function voteEvent(eventId: number, vote: Vote) {
  const { data } = await api.put<CouncilEvent>(`/events/${eventId}/vote`, { vote });
  return data;
}
