import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteComment, editComment, voteComment, type EventComment } from '../../api/comments';
import { VoteButtons } from './VoteButtons';

type Props = { comment: EventComment; onUpdated: (comment: EventComment) => void; onDeleted: (id: number) => void };

export function CommentCard({ comment, onUpdated, onDeleted }: Props) {
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
    <View style={styles.card}>
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
          <View style={styles.voteCounts}>
            <Ionicons name="thumbs-up-outline" size={14} color="#737373" />
            <Text style={styles.author}>{comment.likes}</Text>
            <Ionicons name="thumbs-down-outline" size={14} color="#737373" />
            <Text style={styles.author}>{comment.dislikes}</Text>
          </View>
        ) : <VoteButtons likes={comment.likes} dislikes={comment.dislikes} myVote={comment.my_vote ?? 0}
          label="comment" onVote={async (vote) => onUpdated(await voteComment(comment.event_id, comment.id, vote))} />}
        {comment.is_mine && <View style={styles.ownerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit your comment" disabled={busy} hitSlop={6}
            onPress={() => { setDraft(comment.body); setEditing(true); setError(''); }} style={styles.iconButton}>
            <Ionicons name="pencil-outline" size={14} color="#737373" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete your comment" disabled={busy} hitSlop={6}
            onPress={confirmDelete} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={14} color="#737373" />
          </Pressable>
        </View>}
      </View>}
      {busy && <ActivityIndicator size="small" color="#737373" />}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, gap: 6, backgroundColor: '#fff' },
  author: { fontSize: 11, fontWeight: '600', color: '#737373' },
  body: { fontSize: 14, lineHeight: 21, color: '#171717' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  ownerActions: { flexDirection: 'row', gap: 10 },
  voteCounts: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  iconButton: { minHeight: 28, minWidth: 22, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 76, maxHeight: 180, borderWidth: 1, borderColor: '#a3a3a3', borderRadius: 8, padding: 8, fontSize: 14, color: '#171717', textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 12 },
  textButton: { paddingVertical: 6, paddingHorizontal: 4 },
  actionText: { fontSize: 12, color: '#171717', fontWeight: '600' },
  error: { fontSize: 11, color: '#525252', lineHeight: 16 },
});
