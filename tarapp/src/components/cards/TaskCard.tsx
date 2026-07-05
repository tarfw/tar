import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface TaskCardProps {
  data: any;
  onAction?: (action: string) => void;
}

export function TaskCard({ data, onAction }: TaskCardProps) {
  const theme = useTheme();
  const status = data.status || 'todo';
  const priority = data.priority || 'medium';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{data.title || data.name}</Text>
        <Text style={[styles.priority, { color: priority === 'high' ? '#f44336' : theme.textMuted }]}>
          {priority.toUpperCase()}
        </Text>
      </View>
      {data.assignee && (
        <Text style={[styles.detail, { color: theme.textMuted }]}>Assigned to: {data.assignee}</Text>
      )}
      {data.dueDate && (
        <Text style={[styles.detail, { color: theme.textMuted }]}>Due: {data.dueDate}</Text>
      )}
      {onAction && (
        <View style={styles.actions}>
          {status !== 'done' && (
            <Pressable style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={() => onAction('complete')}>
              <Text style={styles.buttonText}>Complete</Text>
            </Pressable>
          )}
          <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => onAction('reassign')}>
            <Text style={styles.buttonText}>Reassign</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', flex: 1 },
  priority: { fontSize: 12, fontWeight: '600' },
  detail: { fontSize: 14, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
