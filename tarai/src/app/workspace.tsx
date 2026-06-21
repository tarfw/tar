import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator } from 'react-native';
import { Host, BottomSheet } from '@expo/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById, type FormRow } from '@/hooks/use-form';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

type Tab = 'Lists' | 'Tasks' | 'Members';

export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const params = useLocalSearchParams<{ id: string }>();
  const { row, loading: rowLoading } = useFormById(params.id);

  const [activeTab, setActiveTab] = useState<Tab>('Members');
  const [members, setMembers] = useState<FormRow[]>([]);
  const [tasks, setTasks] = useState<FormRow[]>([]);
  const [localTitle, setLocalTitle] = useState('');
  const [showPickMember, setShowPickMember] = useState(false);
  const [allPeople, setAllPeople] = useState<FormRow[]>([]);

  const loadWorkspace = useCallback(async () => {
    if (!row) return;
    setLocalTitle(row.title);

    const memberLinks = await db.getAllAsync<{ tgt: string }>(
      "SELECT tgt FROM graph WHERE src = ? AND type = 'has_member' AND active = 1",
      row.id
    );
    const memberIds = memberLinks.map(l => l.tgt);
    if (memberIds.length > 0) {
      const placeholders = memberIds.map(() => '?').join(',');
      const membersList = await db.getAllAsync<FormRow>(
        `SELECT * FROM form WHERE id IN (${placeholders}) AND active = 1`,
        ...memberIds
      );
      setMembers(membersList);
    } else {
      setMembers([]);
    }

    const taskList = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'task' AND scope = ? AND active = 1 ORDER BY time DESC",
      row.scope
    );
    setTasks(taskList);
  }, [db, row]);

  useEffect(() => {
    if (row) setLocalTitle(row.title);
    loadWorkspace();
  }, [row, loadWorkspace]);

  const handleSaveTitle = async () => {
    if (!row || !localTitle.trim()) return;
    await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), row.id);
  };

  const loadAllPeople = async () => {
    const people = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'profile' AND active = 1 ORDER BY time DESC"
    );
    setAllPeople(people);
    setShowPickMember(true);
  };

  const handleAddMember = async (personId: string) => {
    if (!row) return;
    await db.runAsync(
      'INSERT OR REPLACE INTO graph (src, tgt, type, weight, active) VALUES (?, ?, ?, ?, 1)',
      row.id, personId, 'has_member', 0
    );
    setShowPickMember(false);
    loadWorkspace();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!row) return;
    await db.runAsync(
      'UPDATE graph SET active = 0 WHERE src = ? AND tgt = ? AND type = ?',
      row.id, memberId, 'has_member'
    );
    loadWorkspace();
  };

  const memberIds = new Set(members.map(m => m.id));

  if (rowLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.text, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>Not found</Text>
      </View>
    );
  }

  const data = parseData(row.data);
  const avatarColor = data.color || '#5E6AD2';
  const tabs: Tab[] = ['Lists', 'Tasks', 'Members'];

  return (
    <Host style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        <View style={styles.teamInfo}>
          <View style={[styles.teamAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.teamAvatarText}>{row.title.charAt(0).toUpperCase()}</Text>
          </View>
          <TextInput
            style={[styles.teamName, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Workspace name"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && [styles.tabActive, { borderColor: theme.text }]]}
              onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, { color: activeTab === tab ? theme.text : theme.textSecondary }]}>
                {tab}{tab === 'Members' ? ` ${members.length}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'Members' && (
          <View style={styles.section}>
            {members.map((m) => {
              const md = parseData(m.data);
              return (
                <Pressable key={m.id} style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/entity', params: { id: m.id } })}>
                  <View style={[styles.memberAvatar, { backgroundColor: md.color || '#5E6AD2' }]}>
                    <Text style={styles.memberAvatarText}>{m.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.memberName, { color: theme.text }]}>{m.title}</Text>
                  <Pressable onPress={() => handleRemoveMember(m.id)} style={styles.removeBtn}>
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </Pressable>
              );
            })}
            <Pressable style={[styles.addChip, { backgroundColor: theme.backgroundElement }]} onPress={loadAllPeople}>
              <Ionicons name="add" size={18} color="#5E6AD2" />
              <Text style={[styles.addChipText, { color: '#5E6AD2' }]}>Add member</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'Tasks' && (
          <View style={styles.section}>
            {tasks.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tasks yet</Text>
            ) : (
              tasks.map((t) => (
                <Pressable key={t.id} style={({ pressed }) => [styles.taskRow, pressed && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/entity', params: { id: t.id } })}>
                  <View style={[styles.taskCircle, { borderColor: theme.textSecondary }]} />
                  <Text style={[styles.taskTitle, { color: theme.text }]}>{t.title}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {activeTab === 'Lists' && (
          <View style={styles.section}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No lists yet</Text>
          </View>
        )}

      </ScrollView>

      {/* Pick Member Bottom Sheet */}
      <BottomSheet isPresented={showPickMember} onDismiss={() => setShowPickMember(false)}>
        <Text style={[styles.sheetTitle, { color: theme.text, paddingHorizontal: 20, paddingBottom: 12 }]}>Add Member</Text>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={{ paddingBottom: 20 }}>
          {allPeople.filter(p => !memberIds.has(p.id)).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>All people are already members</Text>
          ) : (
            allPeople.filter(p => !memberIds.has(p.id)).map((p) => {
              const pd = parseData(p.data);
              return (
                <Pressable key={p.id} style={({ pressed }) => [styles.pickRow, pressed && { opacity: 0.6 }]} onPress={() => handleAddMember(p.id)}>
                  <View style={[styles.pickAvatar, { backgroundColor: pd.color || '#5E6AD2' }]}>
                    <Text style={styles.pickAvatarText}>{p.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.pickName, { color: theme.text }]}>{p.title}</Text>
                  <Ionicons name="add-circle-outline" size={22} color="#5E6AD2" />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { padding: 8 },
  menuBtn: { padding: 8 },
  scrollView: { flex: 1 },
  teamInfo: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  teamAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  teamAvatarText: { color: '#ffffff', fontSize: 24, fontWeight: '600' },
  teamName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: '500' },
  section: { paddingHorizontal: 16, paddingTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '500' },
  removeBtn: { padding: 4 },
  addChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  addChipText: { fontSize: 14, fontWeight: '500' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  taskCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  taskTitle: { flex: 1, fontSize: 15 },
  // Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetScroll: { paddingHorizontal: 20 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  pickAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  pickAvatarText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  pickName: { flex: 1, fontSize: 15, fontWeight: '500' },
});
