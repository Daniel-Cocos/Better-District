import { colors } from '../../theme/colors';
import { Plus, Minus, LocateFixed } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

type Props = {
  locating: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
};

export function MapControls({ locating, onZoomIn, onZoomOut, onLocate }: Props) {
  return (
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={onZoomIn}
        style={({ pressed }) => [styles.button, styles.divider, pressed && styles.pressed]}>
        <Plus size={24} color="#171717" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={onZoomOut}
        style={({ pressed }) => [styles.button, styles.divider, pressed && styles.pressed]}>
        <Minus size={24} color="#171717" />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Go to my location"
        accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={onLocate}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        {locating ? <ActivityIndicator color={colors.accent} /> : <LocateFixed size={24} color={colors.accent} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' },
  button: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  pressed: { backgroundColor: '#e5e5e5' },
});
