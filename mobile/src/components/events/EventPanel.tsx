import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, BackHandler, Button, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CouncilEvent } from '../../api/events';
import { listComments, postComment, type EventComment } from '../../api/comments';
import { useSessionStore } from '../../store/session';
import { eventDeadlineLabel } from '../../utils/eventDeadline';
import { useEventsStore } from '../../store/events';
import { VoteButtons } from './VoteButtons';
import { CommentCard } from './CommentCard';

type Props = { event: CouncilEvent; onClose: () => void };

export function EventPanel({ event, onClose }: Props) {
  const session = useSessionStore((state) => state.session);
  const voteEvent = useEventsStore((state) => state.voteEvent);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const list = useRef<FlatList<EventComment>>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => { mounted.current = false; back.remove(); };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    listComments(event.id, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setComments(data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [event.id, retry]);

  async function send() {
    const body = draft.trim();
    if (!body || sending || loading || loadError) return;
    setSending(true);
    setSendError('');
    try {
      const comment = await postComment(event.id, body);
      if (!mounted.current) return;
      setComments((current) => [...current, comment]);
      setDraft('');
      requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
    } catch {
      if (mounted.current) setSendError('Couldn’t post your comment. Your draft is saved here—try again.');
    } finally {
      if (mounted.current) setSending(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close event details" />
      <SafeAreaView style={styles.position} edges={['top']}>
        <KeyboardAvoidingView style={styles.panel} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <View style={styles.titleBar}>
            <Text style={styles.title}>{event.title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close event details" style={styles.close}>
              <Ionicons name="close" size={24} color="#171717" />
            </Pressable>
          </View>
          <FlatList ref={list} data={comments} keyExtractor={(comment) => String(comment.id)}
            style={styles.list} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
            ListHeaderComponent={(
              <View style={styles.header}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color="#737373" accessible={false} />
                  <Text style={styles.description}>{event.description}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#737373" accessible={false} />
                  <Text style={styles.deadline}>{eventDeadlineLabel(event.closes_at)}</Text>
                </View>
                <VoteButtons likes={event.likes} dislikes={event.dislikes} myVote={event.my_vote ?? 0}
                  label={event.title} onVote={(vote) => voteEvent(event.id, vote)} />
              </View>
            )}
            ListEmptyComponent={loading ? <ActivityIndicator color="#171717" style={styles.empty} /> : loadError ? (
              <View style={styles.empty}>
                <Text accessibilityRole="alert">Couldn’t load comments.</Text>
                <Button color="#171717" title="Retry comments" onPress={() => {
                  setLoading(true); setLoadError(false); setRetry((value) => value + 1);
                }} />
              </View>
            ) : <Text style={styles.empty}>No comments yet. Start the conversation.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.commentRow, item.is_mine && styles.ownCommentRow]}>
                <View style={styles.avatar}><Ionicons name="person-outline" size={17} color="#525252" /></View>
                <CommentCard comment={item} onUpdated={(updated) => {
                  if (mounted.current) setComments((current) => current.map((comment) => comment.id === updated.id ? updated : comment));
                }} onDeleted={(id) => { if (mounted.current) setComments((current) => current.filter((comment) => comment.id !== id)); }} />
              </View>
            )} />
          <View style={styles.composer}>
            <Text style={styles.postingAs}>{session.status === 'authenticated' ? `Posting as ${session.email}` : 'Posting anonymously'}</Text>
            {sendError ? <Text style={styles.sendError} accessibilityRole="alert">{sendError}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput accessibilityLabel="Write a comment" placeholder="Add a comment…" placeholderTextColor="#737373"
                value={draft} onChangeText={setDraft} multiline maxLength={5000} style={styles.input} editable={!sending} />
              <Pressable accessibilityRole="button" accessibilityLabel="Post comment"
                disabled={sending || !draft.trim() || loading || loadError}
                accessibilityState={{ disabled: sending || !draft.trim() || loading || loadError, busy: sending }}
                style={[styles.send, (sending || !draft.trim() || loading || loadError) && styles.disabled]} onPress={send}>
                {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  position: { flex: 1, marginLeft: 40, marginRight: 8, marginBottom: 8 },
  panel: { flex: 1, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#d4d4d4', overflow: 'hidden' },
  content: { padding: 16, gap: 16 },
  header: { gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  titleBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  list: { flex: 1, minHeight: 0 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#171717' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  description: { flex: 1, fontSize: 12, lineHeight: 18, color: '#525252' },
  deadline: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#404040' },
  empty: { paddingVertical: 20, color: '#737373', lineHeight: 21 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ownCommentRow: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  composer: { padding: 12, borderTopWidth: 1, borderTopColor: '#e5e5e5', gap: 8 },
  postingAs: { fontSize: 11, color: '#737373' },
  sendError: { fontSize: 12, lineHeight: 18, color: '#525252' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderColor: '#a3a3a3', borderRadius: 12, padding: 4, gap: 4 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 8, paddingVertical: 10, color: '#171717', fontSize: 14 },
  send: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#171717', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
});
