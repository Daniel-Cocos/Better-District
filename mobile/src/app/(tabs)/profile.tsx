import { colors } from '../../theme/colors';
import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect } from 'expo-router';
import { UserRound, ArrowRight, LogOut } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <UserRound size={22} color="#737373" accessible={false} />
              </View>
              <View style={styles.identityText}>
                <Text style={styles.accountName}>{authenticated ? session.email : 'Guest'}</Text>
                {!authenticated && <Link href="/auth" style={styles.link}>Sign in or create an account</Link>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={signOut}
                style={({ pressed }) => [styles.logout, pressed && styles.actionPressed]}>
                <LogOut size={21} color="#737373" accessible={false} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.historyLabel}>History</Text>
          {error ? <Text accessibilityRole="alert" style={styles.description}>{error}</Text> : null}
        </View>}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : !error ? <Text style={styles.description}>Your comments will appear here, newest first.</Text> : undefined}
        renderItem={({ item }) => <View style={styles.historyItem}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.event_title} on the map`}
            accessibilityHint="Shows this initiative on the map and opens its comments"
            onPress={() => router.navigate({ pathname: '/', params: { eventId: String(item.event_id) } })}
            style={({ pressed }) => [styles.eventLink, pressed && styles.eventLinkPressed]}>
            <View style={styles.eventText}>
              <Text style={styles.eventTitle}>{item.event_title}</Text>
              <Text style={styles.mapLabel}>View on map</Text>
            </View>
            <ArrowRight size={18} color={colors.accent} accessible={false} />
          </Pressable>
          <CommentCard comment={item} embedded
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
  account: { gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#d4d4d4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  identityText: { flex: 1, gap: 4 },
  accountName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#171717' },
  logout: { width: 44, height: 44, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  actionPressed: { opacity: 0.6 },
  description: { fontSize: 13, lineHeight: 20, color: '#737373', textAlign: 'center' },
  link: { color: colors.accent, fontSize: 12, lineHeight: 18, fontWeight: '600', paddingVertical: 4 },
  historyLabel: { fontSize: 15, fontWeight: '600', color: '#171717' },
  historyItem: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  eventLink: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  eventLinkPressed: { backgroundColor: '#f0f4f8' },
  eventText: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 13, lineHeight: 18, color: '#171717', fontWeight: '600' },
  mapLabel: { fontSize: 12, color: colors.accent, fontWeight: '600' },
});
