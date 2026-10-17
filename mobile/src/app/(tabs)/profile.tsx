import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommentCard } from '../../components/events/CommentCard';
import { listMyComments, type CommentHistory } from '../../api/comments';
import { useSessionStore } from '../../store/session';

export default function ProfilePage() {
  const session = useSessionStore((state) => state.session);
  const signOut = useSessionStore((state) => state.signOut);
  const authenticated = session.status === 'authenticated';
  const [history, setHistory] = useState<CommentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const identity = authenticated ? session.email : 'guest';

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const comments = await listMyComments(signal);
      if (!signal?.aborted) setHistory(comments);
    } catch { if (!signal?.aborted) setError('Couldn’t load your history. Pull down to retry.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setHistory((current) => current.filter((comment) => identity === 'guest' ? comment.user_email === null : comment.user_email === identity));
    void load(controller.signal);
    return () => controller.abort();
  }, [load, identity]));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList data={loading ? [] : history} keyExtractor={(comment) => String(comment.id)}
        contentContainerStyle={styles.content} refreshing={loading} onRefresh={() => load()}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.account}>
            <Ionicons name="person-outline" size={28} color="#404040" />
            <Text style={styles.description}>{authenticated ? session.email : 'You’re exploring as a guest.'}</Text>
            {!authenticated && <Link href="/auth" style={styles.link}>Sign in or create an account</Link>}
            <Link href="/about" style={styles.link}>About Soton Ship</Link>
            <Button title={authenticated ? 'Sign out' : 'Leave guest session'} color="#171717" onPress={signOut} />
          </View>
          <Text style={styles.historyLabel}>History</Text>
          {error ? <Text accessibilityRole="alert" style={styles.description}>{error}</Text> : null}
        </View>}
        ListEmptyComponent={loading ? <ActivityIndicator color="#171717" /> : !error ? <Text style={styles.description}>Your comments will appear here, newest first.</Text> : undefined}
        renderItem={({ item }) => <View style={styles.historyItem}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.event_title} on the map`}
            onPress={() => router.navigate({ pathname: '/', params: { eventId: String(item.event_id) } })} style={styles.eventLink}>
            <Ionicons name="location-outline" size={14} color="#737373" />
            <Text style={styles.eventTitle}>{item.event_title}</Text>
          </Pressable>
          <CommentCard comment={item}
            onUpdated={(updated) => setHistory((current) => current.map((comment) => comment.id === updated.id ? { ...comment, ...updated } : comment))}
            onDeleted={(id) => setHistory((current) => current.filter((comment) => comment.id !== id))} />
        </View>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 20, gap: 14 },
  header: { gap: 20 },
  account: { padding: 20, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', alignItems: 'center', gap: 12 },
  description: { fontSize: 13, lineHeight: 20, color: '#737373', textAlign: 'center' },
  link: { color: '#171717', fontSize: 13, fontWeight: '600', padding: 4 },
  historyLabel: { fontSize: 15, fontWeight: '600', color: '#171717' },
  historyItem: { gap: 6 },
  eventLink: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 4 },
  eventTitle: { flex: 1, fontSize: 12, color: '#737373', fontWeight: '600' },
});
