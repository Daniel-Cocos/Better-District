import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  icon: LucideIcon;
  description: string;
  children?: ReactNode;
};

export function EmptyTab({ icon: Icon, description, children }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Icon size={32} color="#404040" />
        <Text style={styles.description}>{description}</Text>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', gap: 16, padding: 28, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e5e5' },
  description: { fontSize: 15, lineHeight: 23, color: '#525252', textAlign: 'center' },
});
