import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { type FormRow } from '@/hooks/use-form';

type Filter = 'All' | 'People' | 'Work' | 'Stores';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [people, setPeople] = useState<FormRow[]>([]);
  const [work, setWork] = useState<FormRow[]>([]);
  const [stores, setStores] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const loadData = useCallback(async () => {
    const all = await dbRef.current.getAllAsync<FormRow>('SELECT * FROM form WHERE active = 1 ORDER BY time DESC');
    const p = all.filter(r => r.type === 'profile');
    const w = all.filter(r => r.type === 'team');
    const s = all.filter(r => r.type === 'store');
    setPeople(p);
    setWork(w);
    setStores(s);
    setLoading(false);
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

  const filters: Filter[] = ['All', 'People', 'Work', 'Stores'];

  const showPeople = activeFilter === 'All' || activeFilter === 'People';
  const showWork = activeFilter === 'All' || activeFilter === 'Work';
  const showStores = activeFilter === 'All' || activeFilter === 'Stores';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <View style={[styles.filters, { paddingTop: insets.top + 4 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {filters.map((filter) => (
            <Pressable key={filter} style={[styles.filterTab, activeFilter === filter && [styles.filterTabActive, { borderColor: theme.text }]]} onPress={() => setActiveFilter(filter)}>
              <Text style={[styles.filterText, { color: activeFilter === filter ? theme.text : theme.textSecondary }, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {showPeople && people.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>People</Text>
            {people.map((p) => {
              const d = parseData(p.data);
              return (
                <Pressable key={p.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/entity', params: { id: p.id } })}>
                  <View style={[styles.avatar, { backgroundColor: d.color || '#5E6AD2' }]}>
                    <Text style={styles.avatarText}>{d.initials || p.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{p.title}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {showWork && work.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Work</Text>
            {work.map((w) => {
              const d = parseData(w.data);
              return (
                <Pressable key={w.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/entity', params: { id: w.id } })}>
                  <View style={[styles.workIcon, { backgroundColor: d.color || '#5E6AD2' }]}>
                    <Text style={styles.workIconText}>{w.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{w.title}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {showStores && stores.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Stores</Text>
            {stores.map((s) => {
              return (
                <Pressable key={s.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/entity', params: { id: s.id } })}>
                  <View style={[styles.storeIcon, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="storefront-outline" size={18} color="#fff" />
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{s.title}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {((showPeople && people.length === 0) || (showWork && work.length === 0) || (showStores && stores.length === 0)) && (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>No items yet. Tap + Add to create one.</Text>
        )}
      </ScrollView>

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
  bottomBar: { alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileImage: { width: 32, height: 32, borderRadius: 16 },
  profileName: { fontSize: 15, fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 4 },
  addButtonText: { fontSize: 15, fontWeight: '600' },
  filters: { paddingTop: 4, paddingBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 4 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: '500' },
  filterTextActive: { fontWeight: '600' },
  scrollView: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  workIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  workIconText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  storeIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  listItemTitle: { fontSize: 15, fontWeight: '400', flex: 1 },
  listItemMeta: { fontSize: 12, marginTop: 2 },
  listItemContent: { flex: 1 },
});
