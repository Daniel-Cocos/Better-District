import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyTab({ icon, title, description, children }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Ionicons name={icon} size={32} color="#404040" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', gap: 16, padding: 28, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e5e5' },
  title: { fontSize: 22, fontWeight: '700', color: '#171717', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 23, color: '#525252', textAlign: 'center' },
});
