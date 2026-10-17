import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventFeedCard } from '../../components/events/EventFeedCard';
import { useEventsStore } from '../../store/events';
import { useEventUpdates } from '../../hooks/useEventUpdates';

export default function FeedPage() {
  const events = useEventsStore((state) => state.events);
  const loading = useEventsStore((state) => state.loading);
  const error = useEventsStore((state) => state.error);
  const loadEvents = useEventsStore((state) => state.loadEvents);
  useFocusEffect(useCallback(() => { void loadEvents(); }, [loadEvents]));
  useEventUpdates();

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList data={events} keyExtractor={(event) => String(event.id)}
        contentContainerStyle={styles.content} refreshing={loading} onRefresh={loadEvents}
        ListHeaderComponent={error ? (
            <View style={styles.error}>
              <Text accessibilityRole="alert" style={styles.subtitle}>{error}</Text>
              <Button title="Retry events" color="#171717" onPress={loadEvents} />
            </View>
        ) : undefined}
        ListEmptyComponent={loading ? <ActivityIndicator style={styles.empty} color="#171717" /> : !error ? (
          <Text style={styles.empty}>No events yet. Pull down to refresh.</Text>
        ) : undefined}
        renderItem={({ item }) => <EventFeedCard event={item} onPress={() => {
          router.navigate({ pathname: '/', params: { eventId: String(item.id) } });
        }} />} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 10 },
  subtitle: { fontSize: 13, lineHeight: 20, color: '#737373' },
  error: { padding: 12, gap: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  empty: { padding: 24, textAlign: 'center', color: '#737373' },
});
