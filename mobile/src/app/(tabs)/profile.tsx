import { Link } from 'expo-router';
import { Button, StyleSheet } from 'react-native';
import { EmptyTab } from '../../components/EmptyTab';
import { useSessionStore } from '../../store/session';

export default function ProfilePage() {
  const session = useSessionStore((state) => state.session);
  const signOut = useSessionStore((state) => state.signOut);
  const authenticated = session.status === 'authenticated';

  return (
    <EmptyTab icon="person-outline" title={authenticated ? 'Your profile' : 'Welcome, guest'}
      description={authenticated ? session.email : 'You’re exploring as a guest. Sign in or create an account whenever you’re ready.'}>
      {!authenticated && <Link href="/auth" style={styles.link}>Sign in or create an account</Link>}
      <Link href="/about" style={styles.link}>About Soton Ship</Link>
      <Button title={authenticated ? 'Sign out' : 'Leave guest session'} color="#171717" onPress={signOut} />
    </EmptyTab>
  );
}

const styles = StyleSheet.create({
  link: { color: '#171717', fontSize: 15, fontWeight: '600', padding: 8 },
});
