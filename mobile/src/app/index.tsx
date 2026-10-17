import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomePage() {
  return (
    <View style={styles.container}>
      <Text>hello worls</Text>
      <Link href="/about" style={styles.link}>About this app</Link>
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
