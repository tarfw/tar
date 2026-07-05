import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface BookingCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function BookingCard({ data, onAction }: BookingCardProps) {
  const theme = useTheme();
  const status = data.status || 'confirmed';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{data.service || data.title}</Text>
        <Text style={[styles.status, { color: status === 'confirmed' ? '#4CAF50' : theme.primary }]}>
          {status.toUpperCase()}
        </Text>
      </View>
      {data.date && <Text style={[styles.detail, { color: theme.textMuted }]}>Date: {data.date}</Text>}
      {data.time && <Text style={[styles.detail, { color: theme.textMuted }]}>Time: {data.time}</Text>}
      {data.customer && <Text style={[styles.detail, { color: theme.textMuted }]}>Customer: {data.customer}</Text>}
      {onAction && (
        <View style={styles.actions}>
          <Pressable style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={() => onAction('confirm')}>
            <Text style={styles.buttonText}>Confirm</Text>
          </Pressable>
          <Pressable style={[styles.button, { backgroundColor: '#f44336' }]} onPress={() => onAction('cancel')}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 14, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
