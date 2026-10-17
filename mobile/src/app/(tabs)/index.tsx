import { useCallback } from 'react';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Keyboard, StyleSheet, Text, View } from 'react-native';
import { OpenStreetMap } from '../../components/maps/OpenStreetMap';
import { useEventsStore } from '../../store/events';
import { useEventUpdates } from '../../hooks/useEventUpdates';
import { EventPanel } from '../../components/events/EventPanel';

export default function MapPage() {
  const { eventId } = useLocalSearchParams<{ eventId?: string | string[] }>();
  const selectedId = typeof eventId === 'string' && /^\d+$/.test(eventId) ? Number(eventId) : null;
  const focused = useIsFocused();
  const closePanel = useCallback(() => { Keyboard.dismiss(); router.setParams({ eventId: undefined }); }, []);
  const events = useEventsStore((state) => state.events);
  const loading = useEventsStore((state) => state.loading);
  const error = useEventsStore((state) => state.error);
  const loadEvents = useEventsStore((state) => state.loadEvents);
  const selectedEvent = events.find((event) => event.id === selectedId);

  useFocusEffect(useCallback(() => { void loadEvents(); return () => Keyboard.dismiss(); }, [loadEvents]));
  useEventUpdates();

  return (
    <View style={styles.container}>
      <OpenStreetMap events={events} focusedEvent={focused ? selectedEvent : undefined}
        onSelectEvent={(id) => router.setParams({ eventId: String(id) })} />
      {(loading || error || events.length === 0) && (
        <View style={styles.notice}>
          {loading ? <><ActivityIndicator color="#171717" /><Text>Loading events…</Text></> : error ? (
            <View style={styles.error}>
              <Text accessibilityRole="alert" style={styles.message}>{error}</Text>
              <Button title="Retry events" color="#171717" onPress={loadEvents} />
            </View>
          ) : <Text>No events nearby yet.</Text>}
        </View>
      )}
      {focused && selectedEvent && <EventPanel key={selectedEvent.id} event={selectedEvent} onClose={closePanel} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notice: { position: 'absolute', top: 48, alignSelf: 'center', maxWidth: '90%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { gap: 8 },
  message: { color: '#525252', textAlign: 'center' },
});
