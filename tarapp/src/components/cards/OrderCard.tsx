import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface OrderCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function OrderCard({ data, onAction }: OrderCardProps) {
  const theme = useTheme();
  const items = data.items || [];
  const total = data.total || data.value || 0;
  const status = data.status || 'pending';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Order #{data.id?.slice(-6)}</Text>
        <Text style={[styles.status, { color: status === 'completed' ? '#4CAF50' : theme.primary }]}>
          {status.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.detail, { color: theme.textMuted }]}>
        {items.length} items · ₹{total}
      </Text>
      {onAction && (
        <View style={styles.actions}>
          {status === 'pending' && (
            <>
              <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => onAction('confirm')}>
                <Text style={styles.buttonText}>Confirm</Text>
              </Pressable>
              <Pressable style={[styles.button, { backgroundColor: '#f44336' }]} onPress={() => onAction('cancel')}>
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
            </>
          )}
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
  detail: { fontSize: 14, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
