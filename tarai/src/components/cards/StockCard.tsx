import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface StockCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function StockCard({ data, onAction }: StockCardProps) {
  const theme = useTheme();
  const qty = data.qty || 0;
  const minStock = data.min_stock || 0;
  const isLow = qty <= minStock;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: isLow ? '#FF9800' : theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{data.title || data.name}</Text>
        {isLow && <Text style={styles.alert}>LOW STOCK</Text>}
      </View>
      <Text style={[styles.detail, { color: theme.textMuted }]}>
        Qty: {qty} {data.unit || 'units'}
      </Text>
      {onAction && (
        <View style={styles.actions}>
          <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => onAction('restock')}>
            <Text style={styles.buttonText}>Restock</Text>
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
  alert: { fontSize: 12, fontWeight: '700', color: '#FF9800' },
  detail: { fontSize: 14, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
