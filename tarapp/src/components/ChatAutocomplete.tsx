import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface Memory {
  id: string;
  text: string;
  intent: string;
  workflow?: string;
  slots: Array<{ key: string; label: string; type: string; value: any }>;
}

interface ChatAutocompleteProps {
  memories: Memory[];
  onSelect: (memory: Memory) => void;
}

export function ChatAutocomplete({ memories, onSelect }: ChatAutocompleteProps) {
  const theme = useTheme();

  if (memories.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.item, { borderBottomColor: theme.border }]}
            onPress={() => onSelect(item)}>
            <Text style={[styles.text, { color: theme.text }]}>{item.text}</Text>
            <Text style={[styles.hint, { color: theme.textMuted }]}>tap to use</Text>
          </Pressable>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingVertical: 8 },
  list: { paddingHorizontal: 12, gap: 8 },
  item: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, maxWidth: 200 },
  text: { fontSize: 13, fontWeight: '500' },
  hint: { fontSize: 11, marginTop: 2 },
});
