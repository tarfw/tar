import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById, type FormRow } from '@/hooks/use-form';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const params = useLocalSearchParams<{ id: string }>();
  const { row: team, loading: teamLoading } = useFormById(params.id);

  const [members, setMembers] = useState<FormRow[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!team) return;
    const rows = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'profile' AND scope = ? AND active = 1 ORDER BY time DESC",
      team.scope
    );
    console.log(`[TEAM] Loaded ${rows.length} members for scope ${team.scope}`);
    setMembers(rows);
  }, [db, team]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !team) return;
    const id = `form_member_${Date.now()}`;
    const now = new Date().toISOString();
    const initials = newMemberName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const colors = ['#5E6AD2', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#007AFF'];
    const color = colors[members.length % colors.length];

    console.log(`[TEAM] Adding member "${newMemberName.trim()}" to scope ${team.scope}`);
    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, 'profile', newMemberName.trim(), team.scope,
      JSON.stringify({ role: 'Member', initials, color }),
      now
    );
    // Link member to team via graph
    await db.runAsync(
      'INSERT OR REPLACE INTO graph (src, tgt, type, weight, active) VALUES (?, ?, ?, ?, 1)',
      team.id, id, 'has_member', members.length
    );
    setNewMemberName('');
    setShowAddMember(false);
    await loadMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;
    console.log(`[TEAM] Removing member ${memberId} from scope ${team.scope}`);
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', memberId);
    await db.runAsync('DELETE FROM graph WHERE src = ? AND tgt = ? AND type = ?', team.id, memberId, 'has_member');
    await loadMembers();
  };

  if (teamLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.text, fontSize: 16, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>Team not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}>
        {/* Team Title with Icon */}
        <View style={styles.teamHeader}>
          <View style={[styles.teamIcon, { backgroundColor: '#5E6AD2' }]}>
            <Text style={styles.teamIconText}>t</Text>
          </View>
          <Text style={[styles.teamTitle, { color: theme.text }]}>{team.title}</Text>
        </View>
        <Text style={[styles.teamScope, { color: theme.textSecondary }]}>{team.scope}</Text>

        {/* Members Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>MEMBERS {'\u00B7'} {members.length}</Text>
          <Pressable onPress={() => setShowAddMember(!showAddMember)}>
            <Text style={[styles.addBtn, { color: '#007AFF' }]}>{showAddMember ? 'Cancel' : '+ Add'}</Text>
          </Pressable>
        </View>

        {showAddMember && (
          <View style={styles.addMemberRow}>
            <TextInput
              style={[styles.addMemberInput, { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.backgroundElement }]}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Member name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <Pressable style={[styles.addMemberBtn, { backgroundColor: '#5E6AD2' }]} onPress={handleAddMember}>
              <Text style={styles.addMemberBtnText}>Add</Text>
            </Pressable>
          </View>
        )}

        {members.length === 0 ? (
          <Text style={[styles.emptyMembers, { color: theme.textSecondary }]}>No members yet</Text>
        ) : (
          members.map((m, i) => {
            const d = parseData(m.data);
            return (
              <View key={m.id}>
                <View style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: d.color || '#5E6AD2' }]}>
                    <Text style={styles.memberAvatarText}>{d.initials || m.title.charAt(0)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{m.title}</Text>
                    <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{d.role || 'Member'}</Text>
                  </View>
                  <Pressable onPress={() => {
                    Alert.alert('Remove Member', `Remove ${m.title}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => handleRemoveMember(m.id) },
                    ]);
                  }}>
                    <Text style={{ color: '#FF3B30', fontSize: 13 }}>Remove</Text>
                  </Pressable>
                </View>
                {i < members.length - 1 && <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  teamIcon: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  teamIconText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  teamTitle: { fontSize: 28, fontWeight: '700' },
  teamScope: { fontSize: 14, paddingHorizontal: 16, paddingBottom: 8, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { fontSize: 14, fontWeight: '500' },
  addMemberRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  addMemberInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addMemberBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' },
  addMemberBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  emptyMembers: { padding: 20, textAlign: 'center', fontSize: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '500' },
  memberRole: { fontSize: 13, marginTop: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
