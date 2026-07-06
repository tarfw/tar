import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tar } from '@/lib/tar';

interface SearchResult {
  id: string;
  title: string;
  type: string;
  text?: string;
}

const TYPE_COLORS: Record<string, string> = {
  action: '#4CAF50',
  skill: '#2196F3',
  workflow: '#FF9800',
  memory: '#9C27B0',
};

const TYPE_ICONS: Record<string, string> = {
  action: 'flash-outline',
  skill: 'book-outline',
  workflow: 'git-branch-outline',
  memory: 'sparkles-outline',
};

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setTouched(true);
    try {
      const data = await tar.search(q);
      setResults(data.rows || []);
    } catch (e) {
      console.warn('[Explore] Search failed:', e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const renderItem = useCallback(({ item }: { item: SearchResult }) => {
    const color = TYPE_COLORS[item.type] || theme.textMuted;
    const icon = (TYPE_ICONS[item.type] || 'document-outline') as any;
    return (
      <View style={[styles.resultRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={styles.resultText}>
          <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title || item.id}
          </Text>
          {item.text ? (
            <Text style={[styles.resultSnippet, { color: theme.textMuted }]} numberOfLines={1}>
              {item.text}
            </Text>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: color + '15' }]}>
          <Text style={[styles.typeText, { color }]}>{item.type}</Text>
        </View>
      </View>
    );
  }, [theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.header, { color: theme.text }]}>Explore</Text>
      </View>

      {/* Search input — flat, no border */}
      <View style={[styles.searchWrap, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Actions, skills, workflows..."
          placeholderTextColor={theme.textMuted}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Ionicons
            name="close-circle"
            size={18}
            color={theme.textMuted}
            onPress={() => { setQuery(''); setResults([]); setTouched(false); }}
          />
        )}
      </View>

      {/* Results */}
      {searching ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : touched && results.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No results</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.count, { color: theme.textMuted }]}>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !touched ? (
              <View style={styles.centered}>
                <Ionicons name="compass-outline" size={40} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted, marginTop: 8 }]}>
                  Find actions, skills, and workflows
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  header: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  count: { fontSize: 12, fontWeight: '500', paddingHorizontal: 20, paddingVertical: 10 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  resultText: { flex: 1, gap: 2 },
  resultTitle: { fontSize: 14, fontWeight: '500' },
  resultSnippet: { fontSize: 12 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13 },
});
