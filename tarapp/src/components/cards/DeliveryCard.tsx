import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface DeliveryCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function DeliveryCard({ data, onAction }: DeliveryCardProps) {
  const theme = useTheme();
  const status = data.status || 'pending';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Delivery #{data.id?.slice(-6)}</Text>
        <Text style={[styles.status, { color: status === 'delivered' ? '#4CAF50' : theme.primary }]}>
          {status.toUpperCase()}
        </Text>
      </View>
      {data.pickup && <Text style={[styles.detail, { color: theme.textMuted }]}>From: {data.pickup}</Text>}
      {data.drop && <Text style={[styles.detail, { color: theme.textMuted }]}>To: {data.drop}</Text>}
      {onAction && (
        <View style={styles.actions}>
          {status === 'pending' && (
            <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => onAction('accept')}>
              <Text style={styles.buttonText}>Accept</Text>
            </Pressable>
          )}
          {status === 'in_transit' && (
            <Pressable style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={() => onAction('delivered')}>
              <Text style={styles.buttonText}>Delivered</Text>
            </Pressable>
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
  detail: { fontSize: 14, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
