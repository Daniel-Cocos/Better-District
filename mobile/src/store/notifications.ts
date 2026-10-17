import { create } from 'zustand';
import { listNotifications, markNotificationRead, type ReplyNotification } from '../api/notifications';
import { useSessionStore } from './session';

type NotificationsStore = {
  items: ReplyNotification[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
};

let generation = 0;
export const useNotificationsStore = create<NotificationsStore>((set) => ({
  items: [], loading: false, error: '',
  refresh: async () => {
    const request = ++generation;
    set({ loading: true });
    try {
      const items = await listNotifications();
      if (request === generation) set({ items, error: '' });
    } catch {
      if (request === generation) set({ error: 'Couldn’t load notifications. Please try again.' });
    } finally {
      if (request === generation) set({ loading: false });
    }
  },
  markRead: async (id) => {
    const session = useSessionStore.getState().session;
    await markNotificationRead(id);
    if (session === useSessionStore.getState().session) {
      set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, is_read: true } : item) }));
    }
  },
}));

useSessionStore.subscribe((state, previous) => {
  if (state.session !== previous.session) {
    generation++;
    useNotificationsStore.setState({ items: [], loading: false, error: '' });
  }
});
