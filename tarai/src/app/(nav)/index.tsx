import { useState, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useMotion, type ActionItem } from '@/hooks/use-motion';

type Urgency = 'Now' | 'Next' | 'Later' | 'Done';

function StatusCircle({ status, color }: { status: 'todo' | 'in_progress' | 'done'; color: string }) {
  if (status === 'todo') {
    return <View style={[styles.circle, { borderColor: color, borderStyle: 'dotted' }]} />;
  }
  return <View style={[styles.circleFilled, { backgroundColor: color }]} />;
}

function ActionRow({ action, theme }: { action: ActionItem; theme: any }) {
  return (
    <View style={styles.actionContainer}>
      <Pressable style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}>
        <View style={styles.circleColumn}>
          <StatusCircle status={action.status} color={theme.textSecondary} />
        </View>
        <View style={styles.actionContent}>
          <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
          <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>
            {action.vertical} · {action.scope}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Urgency>('Now');
  const { actions, loading, refresh } = useMotion();

  const filters: Urgency[] = ['Now', 'Next', 'Later', 'Done'];

  const filtered = actions.filter(a => a.urgency === activeFilter);

  // Reload only when returning to this screen (skip initial mount)
  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) {
        refresh();
      }
      isMounted.current = true;
    }, [refresh])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Actions</Text>
      </View>

      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filterTab, activeFilter === filter && [styles.filterTabActive, { borderColor: theme.text }]]}
            onPress={() => setActiveFilter(filter)}>
            <Text style={[styles.filterText, { color: activeFilter === filter ? theme.text : theme.textSecondary }, activeFilter === filter && styles.filterTextActive]}>
              {filter}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}>
          {filtered.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>No actions</Text>
          ) : (
            filtered.map((action) => (
              <ActionRow key={action.id} action={action} theme={theme} />
            ))
          )}
        </ScrollView>
      )}

      <View style={[styles.actionBar, { paddingBottom: insets.bottom - 4, backgroundColor: theme.background, borderColor: theme.backgroundElement }]}>
        <View style={styles.chipRow}>
          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push({ pathname: '/add', params: { type: 'task' } })}>
            <Text style={[styles.chipText, { color: theme.text }]}>+ Task</Text>
          </Pressable>
          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => router.push('/browse')}>
            <Text style={[styles.chipText, { color: theme.text }]}>Browse</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  filterTabActive: { borderBottomWidth: 2 },
  filterText: { fontSize: 14, fontWeight: '500' },
  filterTextActive: { fontWeight: '600' },
  scrollView: { flex: 1 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actionContainer: { marginBottom: 4 },
  circleColumn: { width: 20, alignItems: 'center', paddingTop: 2 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '500' },
  actionSubtitle: { fontSize: 13, marginTop: 2 },
  circle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  circleFilled: { width: 18, height: 18, borderRadius: 9 },
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  chipRow: { flexDirection: 'row', gap: 12 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  chipText: { fontSize: 15, fontWeight: '600' },
});
