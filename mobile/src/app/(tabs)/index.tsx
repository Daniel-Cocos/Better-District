import { useCallback, useState } from 'react';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, Keyboard, StyleSheet, Text, View } from 'react-native';
import { IssuePanel } from '../../components/events/IssuePanel';
import { useNotificationsStore } from '../../store/notifications';
import { listIssues, type CommunityIssue } from '../../api/issues';
import { OpenStreetMap } from '../../components/maps/OpenStreetMap';
import { useEventsStore } from '../../store/events';
import { useEventUpdates } from '../../hooks/useEventUpdates';
import { EventPanel } from '../../components/events/EventPanel';

export default function MapPage() {
  const { eventId, issueId, submitted } = useLocalSearchParams<{ eventId?: string | string[]; issueId?: string | string[]; submitted?: string | string[] }>();
  const selectedId = typeof eventId === 'string' && /^\d+$/.test(eventId) ? Number(eventId) : null;
  const [issues, setIssues] = useState<CommunityIssue[]>([]);
  const [issuesError, setIssuesError] = useState(false);
  const selectedIssue = issues.find((issue) => String(issue.id) === issueId);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      try { const data = await listIssues(controller.signal); if (!controller.signal.aborted) { setIssues(data); setIssuesError(false); } }
      catch { if (!controller.signal.aborted) setIssuesError(true); }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []));
  const focused = useIsFocused();
  const closePanel = useCallback(() => { Keyboard.dismiss(); router.setParams({ eventId: undefined, issueId: undefined, submitted: undefined }); }, []);
  const events = useEventsStore((state) => state.events);
  const loading = useEventsStore((state) => state.loading);
  const error = useEventsStore((state) => state.error);
  const loadEvents = useEventsStore((state) => state.loadEvents);
  const selectedEvent = events.find((event) => event.id === selectedId);

  useFocusEffect(useCallback(() => { void loadEvents(); return () => Keyboard.dismiss(); }, [loadEvents]));
  useEventUpdates();

  return (
    <View style={styles.container}>
      <OpenStreetMap events={events} issues={issues} focusedEvent={focused ? selectedIssue ?? selectedEvent : undefined}
        onSelectIssue={(id) => router.setParams({ issueId: String(id), eventId: undefined, submitted: undefined })}
        onSelectEvent={(id) => router.setParams({ eventId: String(id), issueId: undefined, submitted: undefined })} />
      {(loading || error || (events.length === 0 && issues.length === 0)) && (
        <View style={styles.notice}>
          {loading ? <><ActivityIndicator color="#171717" /><Text>Loading events…</Text></> : error ? (
            <View style={styles.error}>
              <Text accessibilityRole="alert" style={styles.message}>{error}</Text>
              <Button title="Retry events" color="#171717" onPress={loadEvents} />
            </View>
          ) : <Text>No events nearby yet.</Text>}
        </View>
      )}
      {issuesError && <View style={styles.issueError}><Text accessibilityRole="alert">Couldn’t refresh your issues. Retrying…</Text></View>}
      {focused && selectedIssue && <IssuePanel key={selectedIssue.id} issue={selectedIssue} justSubmitted={submitted === '1'} onClose={closePanel}
        onUpdated={(updated) => setIssues((current) => current.map((issue) => issue.id === updated.id ? updated : issue))}
        onDeleted={() => { setIssues((current) => current.filter((issue) => issue.id !== selectedIssue.id)); closePanel(); void useNotificationsStore.getState().refresh(); }} />}
      {focused && !selectedIssue && selectedEvent && <EventPanel key={selectedEvent.id} event={selectedEvent} onClose={closePanel} />}
    </View>
  );
}

const styles = StyleSheet.create({
  issueError: { position: 'absolute', bottom: 16, alignSelf: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 12 },
  container: { flex: 1 },
  notice: { position: 'absolute', top: 48, alignSelf: 'center', maxWidth: '90%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { gap: 8 },
  message: { color: '#525252', textAlign: 'center' },
});
