import { colors } from '../../theme/colors';
import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect } from 'expo-router';
import { UserRound, ArrowRight, LogOut } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommentCard } from '../../components/events/CommentCard';
import { listMyComments, type CommentHistory } from '../../api/comments';
import { ISSUE_CATEGORIES, issuePhotoUrl, listIssues, type CommunityIssue } from '../../api/issues';
import { useSessionStore } from '../../store/session';

export default function ProfilePage() {
  const session = useSessionStore((state) => state.session);
  const signOut = useSessionStore((state) => state.signOut);
  const authenticated = session.status === 'authenticated';
  const [history, setHistory] = useState<CommentHistory[]>([]);
  // Only accounts get a report history; guests' reports are tied to this device alone
  const [reports, setReports] = useState<CommunityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const identity = authenticated ? session.email : 'guest';

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const [comments, issues] = await Promise.all([listMyComments(signal), authenticated ? listIssues(signal) : []]);
      if (!signal?.aborted) { setHistory(comments); setReports(issues); }
    } catch { if (!signal?.aborted) setError('Couldn’t load your history. Pull down to retry.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [authenticated]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setHistory((current) => current.filter((comment) => identity === 'guest' ? comment.user_email === null : comment.user_email === identity));
    setReports([]);
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
          {error ? <Text accessibilityRole="alert" style={styles.description}>{error}</Text> : null}
          {authenticated && <View style={styles.section}>
            <Text style={styles.historyLabel}>Your reports</Text>
            {loading ? <ActivityIndicator color={colors.accent} /> : reports.length === 0 && !error
              ? <Text style={styles.description}>Issues you report will appear here, newest first.</Text>
              : reports.map((report) => <Pressable key={report.id} accessibilityRole="button" accessibilityLabel={`Open your report ${report.title} on the map`}
                accessibilityHint="Shows this report on the map, where you can edit or delete it"
                onPress={() => router.navigate({ pathname: '/', params: { issueId: String(report.id), eventId: undefined, submitted: undefined } })}
                style={({ pressed }) => [styles.report, pressed && styles.eventLinkPressed]}>
                <Image source={{ uri: issuePhotoUrl(report) }} accessible={false} style={styles.thumbnail} />
                <View style={styles.eventText}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{report.title}</Text>
                  <Text style={styles.reportMeta}>{ISSUE_CATEGORIES.find((option) => option.value === report.category)?.label ?? 'Other'} · {STATUS_LABELS[report.status]} · {reportDate(report.created_at)}</Text>
                </View>
                <ArrowRight size={18} color={colors.accent} accessible={false} />
              </Pressable>)}
          </View>}
          <Text style={styles.historyLabel}>Your comments</Text>
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

const STATUS_LABELS: Record<CommunityIssue['status'], string> = { submitted: 'Submitted', reviewed: 'Reviewed', planned: 'Planned', resolved: 'Resolved' };
// SQLite timestamps are UTC without a zone marker
function reportDate(createdAt: string) {
  const date = new Date(`${createdAt.replace(' ', 'T')}Z`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : createdAt;
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
  section: { gap: 10 },
  report: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, minHeight: 72, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#fff' },
  thumbnail: { width: 64, height: 48, borderRadius: 8, backgroundColor: '#e5e5e5' },
  reportMeta: { fontSize: 12, color: '#737373' },
  historyItem: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  eventLink: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  eventLinkPressed: { backgroundColor: '#f0f4f8' },
  eventText: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 13, lineHeight: 18, color: '#171717', fontWeight: '600' },
  mapLabel: { fontSize: 12, color: colors.accent, fontWeight: '600' },
});
