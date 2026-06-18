import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, Text, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { type FormRow } from '@/hooks/use-form';

export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [teams, setTeams] = useState<FormRow[]>([]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'team' AND active = 1 ORDER BY time DESC"
    );
    console.log(`[WORKSPACE] Loaded ${rows.length} teams`);
    setTeams(rows);
  }, [db]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: '#007AFF' }]}>{'\u2039'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Workspace</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TEAMS {'\u00B7'} {teams.length}</Text>
        <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
          {teams.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No teams yet. Create one from Browse + Add.</Text>
          ) : (
            teams.map((team, i) => (
              <View key={team.id}>
                <Pressable
                  style={({ pressed }) => [styles.teamRow, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push({ pathname: '/team', params: { id: team.id } })}>
                  <View style={[styles.teamIcon, { backgroundColor: '#5E6AD2' }]}>
                    <Text style={styles.teamIconText}>t</Text>
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={[styles.teamName, { color: theme.text }]}>{team.title}</Text>
                    <Text style={[styles.teamScope, { color: theme.textSecondary }]}>{team.scope}</Text>
                  </View>
                  <Text style={[styles.chevron, { color: theme.textSecondary }]}>{'>'}</Text>
                </Pressable>
                {i < teams.length - 1 && <View style={[styles.separator, { backgroundColor: theme.background }]} />}
              </View>
            ))
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>FORM TYPES</Text>
        <View style={styles.chipRow}>
          {['team', 'product', 'profile', 'template', 'task', 'note', 'project'].map((type) => (
            <Pressable key={type} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '500', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  emptyText: { padding: 20, textAlign: 'center', fontSize: 14 },
  teamRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  teamIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teamIconText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 15, fontWeight: '500' },
  teamScope: { fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 16, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 14, fontWeight: '500' },
});
