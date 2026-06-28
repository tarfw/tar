import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { toolListMatters } from '@/tools/core/list_matters';
import { toolSearchMemory } from '@/tools/core/search_memory';
import { getSelfId } from '@/lib/db';

type Filter = 'All' | 'People' | 'Work' | 'Stores' | 'Tasks' | 'Leads' | 'Products';

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const userId = await getSelfId();
      const scope = `user_${userId}`;

      const result = await toolListMatters.run({
        input: { table: 'matter', scope, limit: 100 },
        signal: new AbortController().signal,
      });

      setItems(result.rows);
    } catch (e) {
      console.error('[Browse] Load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadData();
  }, [loadData]);

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) loadData();
      isMounted.current = true;
    }, [loadData])
  );

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      loadData();
      return;
    }

    setSearching(true);
    try {
      const userId = await getSelfId();
      const scope = `user_${userId}`;

      const results = await toolSearchMemory.run({
        input: { query, scope, limit: 20 },
        signal: new AbortController().signal,
      });

      const matterIds = results.map((r: any) => r.id);
      if (matterIds.length > 0) {
        const matterResult = await toolListMatters.run({
          input: { table: 'matter', scope, limit: 20 },
          signal: new AbortController().signal,
        });
        setItems(matterResult.rows.filter((r: any) => matterIds.includes(r.id)));
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('[Browse] Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  const filters: Filter[] = ['All', 'People', 'Work', 'Stores', 'Tasks', 'Leads', 'Products'];

  const typeMap: Record<Filter, string> = {
    'All': '',
    'People': 'profile',
    'Work': 'team',
    'Stores': 'store',
    'Tasks': 'task',
    'Leads': 'lead',
    'Products': 'product',
  };

  const filteredItems = activeFilter === 'All'
    ? items
    : items.filter((item: any) => item.type === typeMap[activeFilter]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Search Bar */}
      <View style={[styles.searchBar, { paddingTop: insets.top + 4, backgroundColor: theme.background }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); handleSearch(t); }}
            placeholder="Search anything..."
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(''); loadData(); }}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {filters.map((filter) => (
            <Pressable key={filter} style={[styles.filterTab, activeFilter === filter && [styles.filterTabActive, { borderColor: theme.text }]]} onPress={() => setActiveFilter(filter)}>
              <Text style={[styles.filterText, { color: activeFilter === filter ? theme.text : theme.textSecondary }, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Items List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {searching ? (
          <ActivityIndicator style={{ paddingTop: 40 }} color={theme.textSecondary} />
        ) : filteredItems.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>No items found.</Text>
        ) : (
          filteredItems.map((item: any) => {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data || {};
            const iconColor = data.color || '#5E6AD2';

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                onPress={() => router.push({ pathname: '/entity', params: { id: item.id } })}>
                <View style={[styles.itemIcon, { backgroundColor: iconColor, borderRadius: item.type === 'profile' ? 16 : 8 }]}>
                  <Text style={styles.iconText}>{item.title?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.listItemMeta, { color: theme.textSecondary }]}>{item.type} · {item.scope}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Add Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
        <Pressable style={[styles.addButton, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push('/add')}>
          <Ionicons name="add" size={20} color={theme.text} />
          <Text style={[styles.addButtonText, { color: theme.text }]}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchText: { flex: 1, fontSize: 15, paddingVertical: 0 },
  bottomBar: { alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  addButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 4 },
  addButtonText: { fontSize: 15, fontWeight: '600' },
  filters: { paddingBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 4 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: '500' },
  filterTextActive: { fontWeight: '600' },
  scrollView: { flex: 1 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  itemIcon: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  iconText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  listItemTitle: { fontSize: 15, fontWeight: '400', flex: 1 },
  listItemMeta: { fontSize: 12, marginTop: 2 },
  listItemContent: { flex: 1 },
});
