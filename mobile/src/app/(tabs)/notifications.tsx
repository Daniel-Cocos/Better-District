import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotificationsStore } from '../../store/notifications';
import { colors } from '../../theme/colors';

export default function NotificationsPage() {
  const { items, loading, error, refresh, markRead } = useNotificationsStore();
  const [openError, setOpenError] = useState('');
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FlatList data={items} keyExtractor={(item) => String(item.id)} refreshing={loading} onRefresh={refresh}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          {error ? <View><Text accessibilityRole="alert">{error}</Text><Button title="Retry" onPress={refresh} color={colors.accent} /></View> : null}
          {openError ? <Text accessibilityRole="alert">{openError}</Text> : null}
        </View>}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : !error ? <View style={styles.empty}>
          <Bell color="#737373" size={32} /><Text style={styles.muted}>Replies and issue updates will appear here.</Text>
        </View> : undefined}
        renderItem={({ item }) => <Pressable accessibilityRole="button"
          accessibilityLabel={`${item.is_read ? '' : 'Unread: '}${item.kind === 'issue_submitted' ? 'Issue submitted' : `${item.user_email ?? 'Anonymous'} replied on`} ${item.event_title}: ${item.body}`}
          style={[styles.card, !item.is_read && styles.unread]} onPress={async () => {
            setOpenError('');
            try { await markRead(item.id); } catch { setOpenError('Couldn’t mark this notification as read. Pull down to refresh and try again.'); }
            router.navigate({ pathname: '/', params: item.issue_id ? { issueId: String(item.issue_id), eventId: undefined } : { eventId: String(item.event_id), issueId: undefined } });
          }}>
          <Text style={styles.author}>{!item.is_read ? '● ' : ''}{item.kind === 'issue_submitted' ? 'Issue submitted' : `${item.user_email ?? 'Anonymous'} replied to you`}</Text>
          <Text style={styles.event}>{item.event_title}</Text>
          <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
          <Text style={styles.muted}>{new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</Text>
        </Pressable>} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16, gap: 12 },
  header: { gap: 12, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#171717' },
  card: { padding: 16, gap: 6, borderWidth: 1, borderColor: '#e5e5e5', backgroundColor: '#fff', borderRadius: 12 },
  unread: { borderColor: colors.accent },
  author: { fontSize: 13, fontWeight: '600', color: colors.accent },
  event: { fontSize: 14, fontWeight: '600', color: '#171717' },
  body: { fontSize: 14, lineHeight: 21, color: '#404040' },
  muted: { fontSize: 12, color: '#737373' },
  empty: { padding: 32, alignItems: 'center', gap: 12 },
});
