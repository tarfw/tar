import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface ExpiryCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function ExpiryCard({ data, onAction }: ExpiryCardProps) {
  const theme = useTheme();
  const isExpired = data.status === 'expired';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: isExpired ? '#f44336' : '#FF9800' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{data.title || data.productName}</Text>
        <Text style={[styles.alert, { color: isExpired ? '#f44336' : '#FF9800' }]}>
          {isExpired ? 'EXPIRED' : 'EXPIRING SOON'}
        </Text>
      </View>
      {data.expiryDate && (
        <Text style={[styles.detail, { color: theme.textMuted }]}>Expiry: {data.expiryDate}</Text>
      )}
      {data.qty && (
        <Text style={[styles.detail, { color: theme.textMuted }]}>Qty: {data.qty}</Text>
      )}
      {onAction && (
        <View style={styles.actions}>
          <Pressable style={[styles.button, { backgroundColor: '#FF9800' }]} onPress={() => onAction('discount')}>
            <Text style={styles.buttonText}>Discount</Text>
          </Pressable>
          <Pressable style={[styles.button, { backgroundColor: '#f44336' }]} onPress={() => onAction('discard')}>
            <Text style={styles.buttonText}>Discard</Text>
          </Pressable>
          <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }]} onPress={() => onAction('dismiss')}>
            <Text style={[styles.buttonText, { color: theme.text }]}>Dismiss</Text>
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
  alert: { fontSize: 12, fontWeight: '700' },
  detail: { fontSize: 14, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
