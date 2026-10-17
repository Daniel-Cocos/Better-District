import { useState } from 'react';
import { router } from 'expo-router';
import { Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authErrorMessage, register, signIn } from '../api/auth';
import { useSessionStore } from '../store/session';

export default function AuthPage() {
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saveSession = useSessionStore((state) => state.signIn);
  const continueAsGuest = useSessionStore((state) => state.continueAsGuest);

  async function submit() {
    if (busy) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password || (mode === 'register' && (password.length < 8 || password.length > 128))) {
      setError(mode === 'register' ? 'Use a password with 8–128 characters.' : 'Enter your password.');
      return;
    }
    setBusy(true);
    try {
      const result = await (mode === 'register' ? register : signIn)(email, password);
      setPassword('');
      saveSession(result.email, result.credentials);
      // Protected routes remove the auth screen when the session changes.
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function enterAsGuest() {
    setPassword('');
    continueAsGuest();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.title}>Welcome to Soton Ship</Text>
            <Text>Sign in to join the conversation, or explore as a guest.</Text>
            <Text style={styles.heading}>{mode === 'signIn' ? 'Sign in' : 'Create an account'}</Text>
            <Text nativeID="email-label">Email</Text>
            <TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
              editable={!busy} maxLength={254} />
            <Text nativeID="password-label">Password</Text>
            <TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword}
              secureTextEntry autoCapitalize="none" autoCorrect={false}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} editable={!busy}
              onSubmitEditing={submit} returnKeyType="go" />
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <Button title={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy} />
            <Button title={mode === 'signIn' ? 'Create an account' : 'Already have an account? Sign in'} disabled={busy}
              onPress={() => { setMode(mode === 'signIn' ? 'register' : 'signIn'); setError(''); }} />
            <Button title="Continue as guest" onPress={enterAsGuest} disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, color: '#111', minHeight: 48 },
  error: { color: '#a01818' },
});
