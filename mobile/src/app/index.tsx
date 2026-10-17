import { Link } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../store/session';

export default function HomePage() {
  const session = useSessionStore((state) => state.session);
  const signOut = useSessionStore((state) => state.signOut);
  return (
    <View style={styles.container}>
      <Text>hello worls</Text>
      <Text>{session.status === 'authenticated' ? `Signed in as ${session.email}` : 'Browsing as a guest'}</Text>
      <Link href="/about" style={styles.link}>About this app</Link>
      {session.status === 'guest' && <Link href="/auth" style={styles.link}>Sign in or create an account</Link>}
      <Button title={session.status === 'authenticated' ? 'Sign out' : 'Leave guest session'} onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  link: {
    color: '#0066cc',
    padding: 12,
    textDecorationLine: 'underline',
  },
});
