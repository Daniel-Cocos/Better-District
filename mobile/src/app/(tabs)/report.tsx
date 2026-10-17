import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ActivityIndicator, Button, Image, KeyboardAvoidingView, Pressable, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import { OpenStreetMap } from '../../components/maps/OpenStreetMap';
import { ISSUE_CATEGORIES, submitIssue, type IssueCategory, type IssueLocation } from '../../api/issues';
import { useNotificationsStore } from '../../store/notifications';
import { colors } from '../../theme/colors';

export default function ReportPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [location, setLocation] = useState<IssueLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  async function pickPhoto(camera: boolean) {
    setPicking(true); setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError('Camera access was declined. You can upload a photo instead.'); return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: false, quality: 0.75, exif: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const asset = result.assets[0];
        if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) { setError('Choose a photo smaller than 10 MB.'); return; }
        setPhoto(asset);
      }
    } catch { setError('Couldn’t open photos. Please try again.'); }
    finally { setPicking(false); }
  }

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

  async function send() {
    if (busy || !title.trim() || !description.trim() || !category || !photo || !location) return;
    setBusy(true); setError('');
    try {
      const result = await submitIssue(title, description, category, location, photo);
      setTitle(''); setDescription(''); setCategory(null); setPhoto(null); setLocation(null);
      void useNotificationsStore.getState().refresh();
      router.navigate({ pathname: '/', params: { issueId: String(result.id), eventId: undefined } });
    } catch (err) {
      setError(isAxiosError(err) && typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Couldn’t submit your issue. Your draft is still here. Please try again.');
    } finally { setBusy(false); }
  }

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Photo</Text>
        {photo && <Image source={{ uri: photo.uri }} accessibilityLabel="Selected issue photo" style={styles.photo} />}
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(true)} style={[styles.photoButton, styles.takePhoto]}>
            <Text style={styles.takePhotoText}>Take photo</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => pickPhoto(false)} style={styles.photoButton}>
            <Text style={styles.uploadPhotoText}>{photo ? 'Change photo' : 'Upload photo'}</Text>
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
        {busy && <ActivityIndicator color={colors.accent} />}
        <Button title={busy ? 'Submitting…' : 'Submit issue'} color={colors.accent} disabled={busy || picking || locating || !category || !photo || !location || !title.trim() || !description.trim()} onPress={send} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' }, content: { padding: 20, gap: 12, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#171717', marginTop: 8 },
  help: { fontSize: 13, lineHeight: 20, color: '#737373' }, buttons: { alignSelf: 'stretch', gap: 10 },
  photoButton: { width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 10 },
  takePhoto: { backgroundColor: colors.accent },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 20, backgroundColor: '#fff' },
  tagSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  tagText: { color: '#171717', fontSize: 14, fontWeight: '500' },
  tagTextSelected: { color: '#fff', fontWeight: '600' },
  takePhotoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  uploadPhotoText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 12, padding: 12, backgroundColor: '#fff', color: '#171717', fontSize: 14 },
  description: { minHeight: 100, textAlignVertical: 'top' }, photo: { width: '100%', height: 200, borderRadius: 12 },
  map: { height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#d4d4d4' },
  error: { color: '#a12622', fontSize: 13, lineHeight: 20 },
});
