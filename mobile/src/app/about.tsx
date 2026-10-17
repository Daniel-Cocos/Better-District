import { StyleSheet, Text, View } from 'react-native';

export default function AboutPage() {
  return (
    <View style={styles.container}>
      <Text>Better District</Text>
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
