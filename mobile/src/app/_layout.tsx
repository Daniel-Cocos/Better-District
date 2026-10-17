import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSessionStore } from '../store/session';

export default function RootLayout() {
  const status = useSessionStore((state) => state.session.status);
  return (
    <>
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#fff' } }}>
        <Stack.Protected guard={status !== 'authenticated'}>
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'signedOut'}>
          <Stack.Screen name="index" options={{ title: 'Home' }} />
          <Stack.Screen name="about" options={{ title: 'About' }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
