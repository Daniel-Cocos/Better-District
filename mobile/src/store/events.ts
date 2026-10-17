import { create } from 'zustand';
import { listEvents, voteEvent, type CouncilEvent, type Vote } from '../api/events';

type EventsStore = {
  events: CouncilEvent[];
  loading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  voteEvent: (eventId: number, vote: Vote) => Promise<void>;
};

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  voteEvent: async (eventId, vote) => {
    const updated = await voteEvent(eventId, vote);
    set((state) => ({ events: state.events.map((event) => event.id === eventId ? updated : event) }));
  },
  loadEvents: async () => {
    // Tab focus and Retry can fire together; share the in-flight request.
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      set({ events: await listEvents() });
    } catch {
      set({ error: 'Couldn’t load events. Check that the backend is running.' });
    } finally {
      set({ loading: false });
    }
  },
  refreshEvents: async () => {
    // Background updates: no spinner, and a missed poll keeps the pins already shown.
    if (get().loading) return;
    try {
      set({ events: await listEvents(), error: null });
    } catch {
      // The next poll tries again.
    }
  },
}));
