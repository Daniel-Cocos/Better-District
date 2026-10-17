import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as Location from 'expo-location';
import { ActivityIndicator, Alert, BackHandler, Button, Image, KeyboardAvoidingView, Pressable, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import { OpenStreetMap } from '../../components/maps/OpenStreetMap';
import { ISSUE_CATEGORIES, submitIssue, type IssueCategory, type IssueLocation } from '../../api/issues';
import { PHOTO_ASPECT, usePhotoPicker } from '../../hooks/usePhotoPicker';
import { useNotificationsStore } from '../../store/notifications';
import { colors } from '../../theme/colors';

export default function ReportPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<IssueLocation | null>(null);
  // Residents check the finished report, photo included, before anything is sent
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const { picking, pickPhoto } = usePhotoPicker(setPhoto, setError);
  const complete = !!category && !!photo && !!location && !!title.trim() && !!description.trim();

  useFocusEffect(useCallback(() => {
    if (!reviewing) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (!busy) setReviewing(false); return true; });
    return () => back.remove();
  }, [reviewing, busy]));

  async function locate() {
    setLocating(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) { setError('Location access was declined. Tap the map to place your pin.'); return; }
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), 15000); }),
      ]);
      setLocation({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    } catch { setError('Couldn’t find your location. Tap the map to place your pin.'); }
    finally { clearTimeout(timer); setLocating(false); }
  }

  function reset() {
    setTitle(''); setDescription(''); setCategory(null); setPhoto(null); setLocation(null); setReviewing(false); setError('');
  }

  function confirmDiscard() {
    Alert.alert('Discard this report?', 'Your photo, details and pin will be cleared.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: reset },
    ]);
  }

  async function send() {
    if (busy || !complete || !category || !photo || !location) return;
    setBusy(true); setError('');
    try {
      const result = await submitIssue(title, description, category, location, photo);
      reset();
      void useNotificationsStore.getState().refresh();
      router.navigate({ pathname: '/', params: { issueId: String(result.id), eventId: undefined, submitted: '1' } });
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Couldn’t submit your issue. Your draft is still here. Please try again.');
    } finally { setBusy(false); }
  }

  const photoPreview = photo && <Image source={{ uri: photo.uri }} resizeMode="contain" accessibilityLabel="Selected issue photo" style={styles.photo} />;

  if (reviewing && complete) return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Check your report</Text>
      <Text style={styles.help}>This is how the council will see it. Nothing is sent until you press Submit report.</Text>
      {photoPreview}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(true)} style={[styles.photoButton, styles.half]}>
          <Text style={styles.uploadPhotoText}>Retake photo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(false)} style={[styles.photoButton, styles.half]}>
          <Text style={styles.uploadPhotoText}>Choose another</Text>
        </Pressable>
      </View>
      <Text style={styles.chip}>{ISSUE_CATEGORIES.find((option) => option.value === category)?.label}</Text>
      <Text style={styles.reviewTitle}>{title.trim()}</Text>
      <Text style={styles.reviewDescription}>{description.trim()}</Text>
      <View style={styles.reviewMap} pointerEvents="none">
        <OpenStreetMap events={[]} onSelectEvent={() => {}} pickingLocation location={location} />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {busy && <ActivityIndicator color={colors.accent} />}
      <Pressable accessibilityRole="button" disabled={busy || picking} onPress={send} style={[styles.photoButton, styles.takePhoto, (busy || picking) && styles.disabled]}>
        <Text style={styles.takePhotoText}>{busy ? 'Submitting…' : 'Submit report'}</Text>
      </Pressable>
      <View style={styles.row}>
        <Button title="Edit details" color={colors.accent} disabled={busy} onPress={() => { setReviewing(false); setError(''); }} />
        <Button title="Discard" color="#a12622" disabled={busy} onPress={confirmDiscard} />
      </View>
    </ScrollView>
  </SafeAreaView>;

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Photo</Text>
        {photo ? photoPreview : <Text style={styles.help}>After taking or choosing a photo you can move and crop it to frame the problem.</Text>}
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(true)} style={[styles.photoButton, styles.takePhoto]}>
            <Text style={styles.takePhotoText}>{photo ? 'Retake photo' : 'Take photo'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(false)} style={styles.photoButton}>
            <Text style={styles.uploadPhotoText}>{photo ? 'Choose another photo' : 'Upload photo'}</Text>
          </Pressable>
          {photo && <Button title="Remove" color="#737373" disabled={busy || picking} onPress={() => setPhoto(null)} />}
        </View>
        <Text style={styles.label}>What kind of problem is it?</Text>
        <View accessibilityRole="radiogroup" style={styles.tags}>
          {ISSUE_CATEGORIES.map((option) => {
            const selected = category === option.value;
            return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={() => setCategory(option.value)} style={[styles.tag, selected && styles.tagSelected]}>
              <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{option.label}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={styles.label}>What needs improving?</Text>
        <TextInput accessibilityLabel="Issue title" placeholder="For example, safer crossing by the school" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} style={styles.input} />
        <Text style={styles.label}>Tell us more</Text>
        <TextInput accessibilityLabel="Issue description" placeholder="Describe the issue and what you would like to see change…" value={description} onChangeText={setDescription} maxLength={5000} multiline editable={!busy} style={[styles.input, styles.description]} />
        <Text style={styles.label}>Where is it?</Text>
        <Text style={styles.help}>Tap the map to place a pin. Drag it to adjust the location.</Text>
        <Button title={locating ? 'Finding location…' : 'Use my current location'} color={colors.accent} disabled={busy || locating} onPress={locate} />
        <View style={styles.map} pointerEvents={busy ? 'none' : 'auto'}>
          <OpenStreetMap events={[]} onSelectEvent={() => {}} pickingLocation location={location} onPickLocation={setLocation} />
        </View>
        <Text style={styles.help}>{location ? `Pin: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Place a pin before submitting.'}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!complete && <Text style={styles.help}>Add a photo, a category, a title, a description and a pin to continue.</Text>}
        <Button title="Review report" color={colors.accent} disabled={busy || picking || locating || !complete} onPress={() => { setError(''); setReviewing(true); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' }, content: { padding: 20, gap: 12, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#171717', marginTop: 8 },
  heading: { fontSize: 18, fontWeight: '600', color: '#171717' },
  help: { fontSize: 13, lineHeight: 20, color: '#737373' }, buttons: { alignSelf: 'stretch', gap: 10 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  photoButton: { width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 10 },
  half: { flex: 1, width: undefined },
  takePhoto: { backgroundColor: colors.accent },
  disabled: { opacity: 0.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 20, backgroundColor: '#fff' },
  tagSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  tagText: { color: '#171717', fontSize: 14, fontWeight: '500' },
  tagTextSelected: { color: '#fff', fontWeight: '600' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eef2f7', color: colors.accent, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  reviewTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#171717' },
  reviewDescription: { fontSize: 14, lineHeight: 22, color: '#404040' },
  takePhotoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  uploadPhotoText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 12, padding: 12, backgroundColor: '#fff', color: '#171717', fontSize: 14 },
  description: { minHeight: 100, textAlignVertical: 'top' },
  photo: { width: '100%', aspectRatio: PHOTO_ASPECT, borderRadius: 12, backgroundColor: '#e5e5e5' },
  map: { height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#d4d4d4' },
  reviewMap: { height: 180, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#d4d4d4' },
  error: { color: '#a12622', fontSize: 13, lineHeight: 20 },
});
