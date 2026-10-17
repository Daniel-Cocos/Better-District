import { useEffect, useState } from 'react';
import { CircleCheck, X } from 'lucide-react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { ActivityIndicator, Alert, BackHandler, Button, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteIssue, editIssue, ISSUE_CATEGORIES, issuePhotoUrl, replaceIssuePhoto, type CommunityIssue } from '../../api/issues';
import { PHOTO_ASPECT, usePhotoPicker } from '../../hooks/usePhotoPicker';
import { colors } from '../../theme/colors';

export function IssuePanel({ issue, justSubmitted, onClose, onUpdated, onDeleted }: { issue: CommunityIssue; justSubmitted?: boolean; onClose: () => void; onUpdated: (issue: CommunityIssue) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { picking, pickPhoto } = usePhotoPicker(setPhoto, setError);
  async function save() {
    if (busy || !title.trim() || !description.trim()) return;
    setBusy(true); setError('');
    try {
      let updated = issue;
      if (title.trim() !== issue.title || description.trim() !== issue.description) updated = await editIssue(issue.id, title, description);
      // Sent separately so a rejected photo doesn't lose the text that was saved
      if (photo) { updated = await replaceIssuePhoto(issue.id, photo); setPhoto(null); }
      onUpdated(updated); setEditing(false);
    }
    catch { setError('Couldn’t save your issue. Your changes are still here.'); }
    finally { setBusy(false); }
  }
  function confirmDelete() {
    Alert.alert('Delete your issue?', 'Your issue and photo will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try { await deleteIssue(issue.id); onDeleted(); }
        catch { setError('Couldn’t delete your issue. Please try again.'); }
        finally { setBusy(false); }
      } },
    ]);
  }
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => back.remove();
  }, [onClose]);
  return <View style={styles.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close issue details" onPress={onClose} style={styles.backdrop} />
    <SafeAreaView edges={['top']} style={styles.position}>
      <View style={styles.panel} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={styles.header}>
          <Text style={styles.title}>{issue.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close issue details" onPress={onClose} style={styles.close}><X size={24} color="#171717" /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {justSubmitted && !editing && <View accessibilityRole="alert" style={styles.submitted}>
            <CircleCheck size={20} color="#2f7d4f" accessible={false} />
            <Text style={styles.submittedText}>Report submitted. The council will review it, and you can still edit or delete it here.</Text>
          </View>}
          <Image source={{ uri: photo?.uri ?? issuePhotoUrl(issue) }} resizeMode="contain" accessibilityLabel={issue.title} style={styles.photo} />
          {editing && <View style={styles.actions}>
            <Button title="Retake photo" color={colors.accent} disabled={busy || picking} onPress={() => pickPhoto(true)} />
            <Button title="Choose photo" color={colors.accent} disabled={busy || picking} onPress={() => pickPhoto(false)} />
          </View>}
          <Text style={styles.tag}>{ISSUE_CATEGORIES.find((c) => c.value === issue.category)?.label ?? 'Other'}</Text>
          {editing ? <>
            <TextInput accessibilityLabel="Issue title" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} style={styles.input} />
            <TextInput accessibilityLabel="Issue description" value={description} onChangeText={setDescription} multiline maxLength={5000} editable={!busy} style={[styles.input, styles.descriptionInput]} />
            <View style={styles.actions}>
              <Button title="Save" disabled={busy || picking || !title.trim() || !description.trim()} onPress={save} />
              <Button title="Cancel" disabled={busy} onPress={() => { setEditing(false); setPhoto(null); setError(''); }} />
            </View>
          </> : <>
            <Text style={styles.description}>{issue.description}</Text>
            <View style={styles.actions}>
              <Button title="Edit" disabled={busy} onPress={() => { setTitle(issue.title); setDescription(issue.description); setEditing(true); setError(''); }} />
              <Button title="Delete" color="#a12622" disabled={busy} onPress={confirmDelete} />
            </View>
          </>}
          {busy && <ActivityIndicator />}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Text style={styles.status}>Status: {issue.status}</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eef2f7', color: '#3e6fa8', fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  position: { flex: 1, marginLeft: 40, marginRight: 8, marginBottom: 8 },
  panel: { flex: 1, borderRadius: 24, backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: '#d4d4d4' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#171717' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  content: { padding: 20, gap: 16 }, photo: { width: '100%', aspectRatio: PHOTO_ASPECT, borderRadius: 12, backgroundColor: '#e5e5e5' },
  submitted: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#eaf5ee' },
  submittedText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#1f5235' },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 10, padding: 12, color: '#171717', fontSize: 14 },
  descriptionInput: { minHeight: 120, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 16 },
  error: { fontSize: 13, color: '#a12622' },
  description: { fontSize: 14, lineHeight: 22, color: '#404040' }, status: { fontSize: 12, color: '#737373' },
});
