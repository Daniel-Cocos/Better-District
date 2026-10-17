import { colors } from '../../theme/colors';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteComment, editComment, voteComment, type EventComment } from '../../api/comments';
import { VoteButtons } from './VoteButtons';

type Props = { comment: EventComment; onUpdated: (comment: EventComment) => void; onDeleted: (id: number) => void; onReply?: (comment: EventComment) => void; replyTo?: string; embedded?: boolean };

export function CommentCard({ comment, onUpdated, onDeleted, onReply, replyTo, embedded = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (busy || !draft.trim()) return;
    setBusy(true); setError('');
    try {
      onUpdated(await editComment(comment.event_id, comment.id, draft));
      setEditing(false);
    } catch { setError('Couldn’t save changes. Your draft is still here.'); }
    finally { setBusy(false); }
  }

  function confirmDelete() {
    Alert.alert('Delete your comment?', 'This removes it from the conversation and your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try { await deleteComment(comment.event_id, comment.id); onDeleted(comment.id); }
        catch { setError('Couldn’t delete your comment. Please try again.'); }
        finally { setBusy(false); }
      } },
    ]);
  }

  return (
    <View style={[styles.card, embedded && styles.embedded]}>
      {replyTo && <Text style={styles.author}>Replying to {replyTo}</Text>}
      <Text style={styles.author}>{comment.user_email ?? 'Anonymous'}{comment.is_mine ? ' · You' : ''}</Text>
      {editing ? (
        <>
          <TextInput accessibilityLabel="Edit your comment" value={draft} onChangeText={setDraft}
            multiline maxLength={5000} editable={!busy} style={styles.input} />
          <View style={styles.editActions}>
            <Pressable accessibilityRole="button" disabled={busy || !draft.trim()} onPress={save} style={styles.textButton}>
              <Text style={styles.actionText}>Save</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setEditing(false); setError(''); }} style={styles.textButton}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : <Text style={styles.body}>{comment.body}</Text>}
      {!editing && <View style={styles.actions}>
        {comment.is_mine ? (
          <VoteButtons likes={comment.likes} dislikes={comment.dislikes} myVote={0} label="comment" readOnly />
        ) : <VoteButtons likes={comment.likes} dislikes={comment.dislikes} myVote={comment.my_vote ?? 0}
          label="comment" onVote={async (vote) => onUpdated(await voteComment(comment.event_id, comment.id, vote))} />}
        <View style={styles.commentActions}>
          {onReply && <Pressable accessibilityRole="button" disabled={busy} onPress={() => onReply(comment)} style={styles.replyButton}>
            <Text style={styles.actionText}>Reply</Text>
          </Pressable>}
          {comment.is_mine && <>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit your comment" disabled={busy} hitSlop={6}
            onPress={() => { setDraft(comment.body); setEditing(true); setError(''); }} style={styles.iconButton}>
            <Pencil size={14} color="#737373" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete your comment" disabled={busy} hitSlop={6}
            onPress={confirmDelete} style={styles.iconButton}>
            <Trash2 size={14} color="#737373" />
          </Pressable>
          </>}
        </View>
      </View>}
      {busy && <ActivityIndicator size="small" color="#737373" />}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, gap: 6, backgroundColor: '#fff' },
  embedded: { borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  author: { fontSize: 11, fontWeight: '600', color: '#737373' },
  body: { fontSize: 14, lineHeight: 21, color: '#171717' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  replyButton: { minHeight: 28, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  iconButton: { minHeight: 28, minWidth: 22, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 76, maxHeight: 180, borderWidth: 1, borderColor: '#a3a3a3', borderRadius: 8, padding: 8, fontSize: 14, color: '#171717', textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 12 },
  textButton: { paddingVertical: 6, paddingHorizontal: 4 },
  actionText: { fontSize: 12, lineHeight: 16, color: colors.accent, fontWeight: '600' },
  error: { fontSize: 11, color: '#525252', lineHeight: 16 },
});
