import { colors } from '../../theme/colors';
import { Clock, ArrowRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CouncilEvent } from '../../api/events';
import { eventDeadlineLabel } from '../../utils/eventDeadline';
import { useEventsStore } from '../../store/events';
import { VoteButtons } from './VoteButtons';

export function EventFeedCard({ event, onPress }: { event: CouncilEvent; onPress: () => void }) {
  const voteEvent = useEventsStore((state) => state.voteEvent);
  return (
    <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${event.title} on the map`}
      onPress={onPress} style={({ pressed }) => [styles.content, pressed && styles.pressed]}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
      <View style={styles.row}>
        <View style={styles.deadlineIcon}><Clock size={14} color="#737373" accessible={false} /></View>
        <Text style={styles.deadline}>{eventDeadlineLabel(event.closes_at)}</Text>
      </View>
    </Pressable>
    <View style={styles.footer}>
      <VoteButtons likes={event.likes} dislikes={event.dislikes} myVote={event.my_vote ?? 0}
        label={event.title} onVote={(vote) => voteEvent(event.id, vote)} />
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${event.title} on map`} onPress={onPress} style={styles.mapLink}>
        <Text style={styles.linkText}>View on map</Text>
        <ArrowRight size={15} color={colors.accent} accessible={false} />
      </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  content: { padding: 12, paddingBottom: 4, gap: 6 },
  footer: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pressed: { backgroundColor: '#f5f5f5' },
  title: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: '#171717' },
  description: { fontSize: 12, lineHeight: 18, color: '#525252' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  deadlineIcon: { height: 18, width: 14, alignItems: 'center', justifyContent: 'center' },
  deadline: { flex: 1, fontSize: 12, lineHeight: 18, color: '#737373' },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  linkText: { fontSize: 12, fontWeight: '600', color: colors.accent },
});
