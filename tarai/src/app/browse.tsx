import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { type FormRow } from '@/hooks/use-form';

type Filter = 'All' | 'Teams' | 'People' | 'Products' | 'Projects' | 'Templates' | 'Notes' | 'Orders' | 'Tickets';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [teams, setTeams] = useState<FormRow[]>([]);
  const [members, setMembers] = useState<FormRow[]>([]);
  const [agents, setAgents] = useState<FormRow[]>([]);
  const [products, setProducts] = useState<FormRow[]>([]);
  const [projects, setProjects] = useState<FormRow[]>([]);
  const [templates, setTemplates] = useState<FormRow[]>([]);
  const [notes, setNotes] = useState<FormRow[]>([]);
  const [orders, setOrders] = useState<FormRow[]>([]);
  const [tickets, setTickets] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const all = await db.getAllAsync<FormRow>('SELECT * FROM form WHERE active = 1 ORDER BY time DESC');
    console.log(`[BROWSE] Loaded ${all.length} forms`);
    setTeams(all.filter(r => r.type === 'team'));
    setMembers(all.filter(r => r.type === 'profile' && r.scope !== 'p'));
    setAgents(all.filter(r => r.type === 'agent'));
    setProducts(all.filter(r => r.type === 'product'));
    setProjects(all.filter(r => r.type === 'project'));
    setTemplates(all.filter(r => r.type === 'template'));
    setNotes(all.filter(r => r.type === 'note'));
    setOrders(all.filter(r => r.type === 'order'));
    setTickets(all.filter(r => r.type === 'ticket'));
    setLoading(false);
  }, [db]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Reload when screen comes into focus (skip initial mount to avoid double load)
  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) {
        load();
      }
      isMounted.current = true;
    }, [load])
  );

  const filters: Filter[] = ['All', 'Teams', 'People', 'Products', 'Projects', 'Templates', 'Notes', 'Orders', 'Tickets'];

  const showTeams = activeFilter === 'All' || activeFilter === 'Teams';
  const showPeople = activeFilter === 'All' || activeFilter === 'People';
  const showProducts = activeFilter === 'All' || activeFilter === 'Products';
  const showProjects = activeFilter === 'All' || activeFilter === 'Projects';
  const showTemplates = activeFilter === 'All' || activeFilter === 'Templates';
  const showNotes = activeFilter === 'All' || activeFilter === 'Notes';
  const showOrders = activeFilter === 'All' || activeFilter === 'Orders';
  const showTickets = activeFilter === 'All' || activeFilter === 'Tickets';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Fixed header + filters */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Browse</Text>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          {filters.map((filter) => (
            <Pressable key={filter} style={[styles.filterTab, activeFilter === filter && [styles.filterTabActive, { borderColor: theme.text }]]} onPress={() => setActiveFilter(filter)}>
              <Text style={[styles.filterText, { color: activeFilter === filter ? theme.text : theme.textSecondary }, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {showTeams && teams.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Teams</Text>
            {teams.map((t) => {
              return (
                <Pressable key={t.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/team', params: { id: t.id } })}>
                  <View style={[styles.teamIcon, { backgroundColor: '#5E6AD2' }]}>
                    <Text style={styles.teamIconText}>t</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{t.title}</Text>
                    <Text style={[styles.listItemSubtitle, { color: theme.textSecondary }]}>{t.scope}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {showPeople && members.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Members</Text>
            {members.map((m) => {
              const d = parseData(m.data);
              return (
                <Pressable key={m.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'member', id: m.id, title: m.title } })}>
                  <View style={[styles.avatar, { backgroundColor: d.color || '#5E6AD2' }]}>
                    <Text style={styles.avatarText}>{d.initials || m.title.charAt(0)}</Text>
                  </View>
                  <Text style={[styles.listItemTitle, { color: theme.text }]}>{m.title}</Text>
                  <Text style={[styles.listItemMeta, { color: theme.textSecondary }]}>{d.role || 'Member'}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {showPeople && agents.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Agents</Text>
            {agents.map((a) => {
              const d = parseData(a.data);
              return (
                <Pressable key={a.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'agent', id: a.id, title: a.title } })}>
                  <View style={[styles.statusDot, { backgroundColor: d.status === 'active' ? '#34C759' : theme.textSecondary }]} />
                  <Text style={[styles.listItemTitle, { color: theme.text }]}>{a.title}</Text>
                  <Text style={[styles.listItemMeta, { color: theme.textSecondary }]}>{d.status || 'idle'}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {showProducts && products.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Products</Text>
            {products.map((p) => {
              const d = parseData(p.data);
              return (
                <Pressable key={p.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'product', id: p.id, title: p.title } })}>
                  <View style={[styles.checkbox, { borderColor: theme.textSecondary }]} />
                  <Text style={[styles.listItemTitle, { color: theme.text }]}>{p.title}</Text>
                  <Text style={[styles.listItemMeta, { color: theme.textSecondary }]}>{d.price ? `₹${d.price.toLocaleString()}` : ''}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {showProjects && projects.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Projects</Text>
            {projects.map((p) => {
              const d = parseData(p.data);
              return (
                <Pressable key={p.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'project', id: p.id, title: p.title } })}>
                  <View style={[styles.diamond, { backgroundColor: d.color || '#5E6AD2' }]} />
                  <Text style={[styles.listItemTitle, { color: theme.text }]}>{p.title}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {showTemplates && templates.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Templates</Text>
            {templates.map((t) => (
              <Pressable key={t.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'template', id: t.id, title: t.title } })}>
                <View style={[styles.square, { borderColor: theme.textSecondary }]} />
                <Text style={[styles.listItemTitle, { color: theme.text }]}>{t.title}</Text>
              </Pressable>
            ))}
          </>
        )}

        {showNotes && notes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Notes</Text>
            {notes.map((n) => (
              <Pressable key={n.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'note', id: n.id, title: n.title } })}>
                <Text style={[styles.listItemTitle, { color: theme.text, paddingLeft: 30 }]}>{n.title}</Text>
              </Pressable>
            ))}
          </>
        )}

        {showOrders && orders.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Orders</Text>
            {orders.map((o) => {
              const d = parseData(o.data);
              return (
                <Pressable key={o.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'order', id: o.id, title: o.title } })}>
                  <View style={[styles.ticketIcon, { backgroundColor: '#5E6AD2' }]}>
                    <Text style={styles.ticketIconText}>#</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{o.title}</Text>
                    <Text style={[styles.listItemSubtitle, { color: theme.textSecondary }]}>{d.status || 'placed'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        {showTickets && tickets.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Tickets</Text>
            {tickets.map((t) => {
              const d = parseData(t.data);
              return (
                <Pressable key={t.id} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/detail', params: { type: 'ticket', id: t.id, title: t.title } })}>
                  <View style={[styles.ticketIcon, { backgroundColor: d.priority === 'Urgent' ? '#FF3B30' : d.priority === 'High' ? '#FF9500' : '#5E6AD2' }]}>
                    <Text style={styles.ticketIconText}>!</Text>
                  </View>
                  <View style={styles.listItemContent}>
                    <Text style={[styles.listItemTitle, { color: theme.text }]}>{t.title}</Text>
                    <Text style={[styles.listItemSubtitle, { color: theme.textSecondary }]}>{d.priority || 'Medium'}</Text>
                  </View>
                  <Text style={[styles.listItemMeta, { color: theme.textSecondary }]}>{d.status || 'Open'}</Text>
                </Pressable>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {((showTeams && teams.length === 0) ||
          (showPeople && members.length + agents.length === 0) ||
          (showProducts && products.length === 0) ||
          (showProjects && projects.length === 0) ||
          (showTemplates && templates.length === 0) ||
          (showNotes && notes.length === 0) ||
          (showOrders && orders.length === 0) ||
          (showTickets && tickets.length === 0)) && (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>No items. Tap + Add to create one.</Text>
        )}
      </ScrollView>

      {/* Add chip above bottom nav */}
      <View style={[styles.addBar, { paddingBottom: insets.bottom + 8, backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
        <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push('/add')}>
          <Text style={[styles.chipText, { color: theme.text }]}>+ Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  addBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, alignSelf: 'flex-start' },
  chipText: { fontSize: 15, fontWeight: '600' },
  filters: { paddingBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 4 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: '500' },
  filterTextActive: { fontWeight: '600' },
  scrollView: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  teamIcon: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  teamIconText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, marginLeft: 6 },
  diamond: { width: 12, height: 12, borderRadius: 2, transform: [{ rotate: '45deg' }], marginLeft: 8 },
  square: { width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, marginLeft: 7 },
  listItemTitle: { fontSize: 15, fontWeight: '400', flex: 1 },
  listItemContent: { flex: 1 },
  listItemSubtitle: { fontSize: 13, marginTop: 2 },
  listItemMeta: { fontSize: 13 },
  ticketIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  ticketIconText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
});
