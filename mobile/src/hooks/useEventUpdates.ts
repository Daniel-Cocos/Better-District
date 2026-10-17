import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getEventsVersion } from '../api/events';
import { useEventsStore } from '../store/events';

const POLL_MS = 5000;

/**
 * While the screen is focused and the app is in the foreground, pick up pins the
 * council publishes (and votes or comments from others) without leaving the tab.
 */
export function useEventUpdates() {
  const refreshEvents = useEventsStore((state) => state.refreshEvents);

  useFocusEffect(useCallback(() => {
    let version: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let polling = false; // one loop at a time; it pauses while the app is in the background

    async function poll() {
      if (stopped || AppState.currentState !== 'active') {
        polling = false;
        return;
      }
      polling = true;
      try {
        const next = await getEventsVersion();
        // The first answer is a baseline: the screen just loaded events on focus.
        if (version !== null && next !== version) await refreshEvents();
        version = next;
      } catch {
        // Offline or the backend restarted; keep trying.
      }
      if (stopped) polling = false;
      else timer = setTimeout(poll, POLL_MS);
    }

    void poll();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !polling) void poll();
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refreshEvents]));
}
