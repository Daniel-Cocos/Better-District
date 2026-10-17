import { colors } from '../../theme/colors';
import { useRef, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Vote } from '../../api/events';

type Props = {
  likes: number;
  dislikes: number;
  myVote: Vote;
  label: string;
} & ({ readOnly?: false; onVote: (vote: Vote) => Promise<void> } | { readOnly: true; onVote?: never });

export function VoteButtons({ likes, dislikes, myVote, label, onVote, readOnly = false }: Props) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function vote(value: -1 | 1) {
    if (pending.current || readOnly || !onVote) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onVote(myVote === value ? 0 : value);
    } catch {
      setError('Couldn’t save your vote. Tap again to retry.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {([1, -1] as const).map((value) => {
          const selected = !readOnly && myVote === value;
          const count = value === 1 ? likes : dislikes;
          const action = value === 1 ? 'Like' : 'Dislike';
          const Icon = value === 1 ? ThumbsUp : ThumbsDown;
          const content = <>
            <Icon size={14} color={selected ? colors.accent : '#737373'} />
            <Text style={[styles.count, selected && styles.selectedText]}>{count}</Text>
          </>;
          if (readOnly) return (
            <View key={value} style={styles.button} accessible accessibilityLabel={`${count} ${value === 1 ? 'likes' : 'dislikes'}`}>
              {content}
            </View>
          );
          return (
            <Pressable key={value} accessibilityRole="button"
              accessibilityLabel={`${action} ${label}, ${count}${selected ? ', tap to remove vote' : ''}`}
              accessibilityState={{ selected, disabled: busy, busy }} disabled={busy}
              hitSlop={6} onPress={() => vote(value)}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              {content}
            </Pressable>
          );
        })}
        {busy && <ActivityIndicator size="small" color="#737373" />}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  button: { minHeight: 28, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.65 },
  count: { fontSize: 11, color: '#737373', fontWeight: '600' },
  selectedText: { color: colors.accent },
  error: { fontSize: 11, lineHeight: 16, color: '#525252' },
});
