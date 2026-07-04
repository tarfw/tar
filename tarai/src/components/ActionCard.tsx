import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState } from 'react';

interface ActionCardProps {
  memory: {
    id: string;
    text: string;
    intent: string;
    workflow?: string;
    slots: Array<{
      key: string;
      label: string;
      type: string;
      value: any;
    }>;
  };
  onExecute: (values: Record<string, any>) => void;
  onCancel: () => void;
}

export function ActionCard({ memory, onExecute, onCancel }: ActionCardProps) {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, any>>(
    memory.slots.reduce((acc, slot) => ({ ...acc, [slot.key]: slot.value || '' }), {} as Record<string, any>)
  );

  const handleExecute = () => {
    onExecute(values);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}>
      <Text style={[styles.title, { color: theme.text }]}>{memory.text}</Text>

      {memory.slots.map((slot) => (
        <View key={slot.key} style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{slot.label}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={String(values[slot.key] || '')}
            onChangeText={(v) => setValues(prev => ({ ...prev, [slot.key]: v }))}
            placeholder={slot.label}
            placeholderTextColor={theme.textMuted}
          />
        </View>
      ))}

      <View style={styles.actions}>
        <Pressable style={[styles.executeButton, { backgroundColor: theme.primary }]} onPress={handleExecute}>
          <Text style={styles.executeButtonText}>Execute</Text>
        </Pressable>
        <Pressable style={[styles.cancelButton, { borderColor: theme.border }]} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: theme.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  field: { marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  executeButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  executeButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelButton: { padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: 14 },
});
