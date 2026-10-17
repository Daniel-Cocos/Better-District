import { StyleSheet, Text, View } from 'react-native';

export default function AboutPage() {
  return (
    <View style={styles.container}>
      <Text>Soton Ship</Text>
      <Text>Discover local events and join the conversation.</Text>
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
});
