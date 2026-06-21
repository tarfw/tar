import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { getCurrentUser, type UserProfile } from '@/lib/auth';
import { type FormRow } from '@/hooks/use-form';
import { type MatterRow } from '@/hooks/use-matter';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

interface Subtask {
  id: string;
  title: string;
  done: boolean;
  type: SubtaskType;
}

type SubtaskType = 'crm' | 'hr' | 'pay' | 'log' | 'mkt' | 'svc' | 'proj' | 'task';

const SUBTASK_TYPES: { key: SubtaskType; label: string; color: string }[] = [
  { key: 'crm', label: 'CRM', color: '#5E6AD2' },
  { key: 'hr', label: 'HR', color: '#FF9500' },
  { key: 'pay', label: 'Pay', color: '#34C759' },
  { key: 'log', label: 'Logistics', color: '#007AFF' },
  { key: 'mkt', label: 'Marketing', color: '#FF2D55' },
  { key: 'svc', label: 'Service', color: '#AF52DE' },
  { key: 'proj', label: 'Project', color: '#5856D6' },
  { key: 'task', label: 'Task', color: '#8E8E93' },
];

function getSubtaskType(type: string): { label: string; color: string } {
  return SUBTASK_TYPES.find(t => t.key === type) || { label: type, color: '#8E8E93' };
}

const PERSONAL_FORM_ID = '__personal_profile__';

export default function PersonalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [matter, setMatter] = useState<MatterRow | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskType, setNewSubtaskType] = useState<SubtaskType>('task');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [motions, setMotions] = useState<any[]>([]);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const loadMatter = useCallback(async () => {
    if (!user) return;

    const existing = await db.getFirstAsync<FormRow>(
      'SELECT * FROM form WHERE id = ?',
      PERSONAL_FORM_ID
    );
    if (existing) {
      setLocalTitle(existing.title);
    } else if (user.name) {
      setLocalTitle(user.name);
    }

    const m = await db.getFirstAsync<MatterRow>(
      "SELECT * FROM matter WHERE form = ? AND type = 'entity_state' AND active = 1 LIMIT 1",
      PERSONAL_FORM_ID
    );
    setMatter(m);
    if (m) {
      const d = parseData(m.data);
      setSubtasks(d.subtasks || []);
    }

    const mov = await db.getAllAsync<any>(
      "SELECT * FROM motion WHERE stream = ? ORDER BY seq DESC LIMIT 20",
      PERSONAL_FORM_ID
    );
    setMotions(mov);
  }, [db, user]);

  useEffect(() => {
    if (user) {
      loadMatter();
    }
  }, [user, loadMatter]);

  const ensureMatter = async (): Promise<MatterRow> => {
    if (matter) return matter;
    const now = new Date().toISOString();
    const matterId = `matter_${Date.now()}`;
    await db.runAsync(
      "INSERT INTO matter (id, form, type, data, time, active) VALUES (?, ?, 'entity_state', '{}', ?, 1)",
      matterId, PERSONAL_FORM_ID, now
    );
    const m = await db.getFirstAsync<MatterRow>(
      "SELECT * FROM matter WHERE id = ?", matterId
    );
    setMatter(m);
    return m!;
  };

  const saveMatter = async (updates: Record<string, any>) => {
    const m = await ensureMatter();
    const data = parseData(m.data);
    const merged = { ...data, ...updates };
    await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', JSON.stringify(merged), m.id);
    await loadMatter();
  };

  const handleSaveTitle = async () => {
    if (!localTitle.trim()) return;
    const existing = await db.getFirstAsync<FormRow>(
      'SELECT id FROM form WHERE id = ?',
      PERSONAL_FORM_ID
    );
    if (existing) {
      await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), PERSONAL_FORM_ID);
    }
  };

  const handleToggleSubtask = (id: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s);
    setSubtasks(updated);
    saveMatter({ subtasks: updated });
  };

  const handleUpdateSubtaskTitle = (id: string, newTitle: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setSubtasks(updated);
    saveMatter({ subtasks: updated });
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    const sub: Subtask = { id: `sub_${Date.now()}`, title: newSubtask.trim(), done: false, type: newSubtaskType };
    const updated = [...subtasks, sub];
    setSubtasks(updated);
    setNewSubtask('');
    await saveMatter({ subtasks: updated });

    const last = await db.getFirstAsync<{ max_seq: number }>(
      'SELECT COALESCE(MAX(seq), 0) + 1 as max_seq FROM motion WHERE stream = ?',
      PERSONAL_FORM_ID
    );
    const seq = last?.max_seq ?? 1;
    await db.runAsync(
      "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 100, 0, ?, ?)",
      PERSONAL_FORM_ID, seq, JSON.stringify({ title: sub.title, type: sub.type }), new Date().toISOString()
    );
    await loadMatter();
  };

  const handleDeleteSubtask = (id: string) => {
    const updated = subtasks.filter(s => s.id !== id);
    setSubtasks(updated);
    saveMatter({ subtasks: updated });
  };

  const formatTime = (time: string) => {
    const d = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const motionLabel = (action: number) => {
    const labels: Record<number, string> = {
      100: 'Subtask added',
    };
    return labels[action] || `Action ${action}`;
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  const activeTasks = subtasks.filter(s => !s.done);
  const doneTasks = subtasks.filter(s => s.done);
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user.email.charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}>

        {/* Header */}
        <View style={styles.titleRow}>
          {user.photo ? (
            <Image source={{ uri: user.photo }} style={[styles.avatar, { backgroundColor: '#5E6AD2' }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#5E6AD2' }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
          />
          <Pressable onPress={() => setShowMenu(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Contact chips */}
        <View style={styles.chipsRow}>
          {user.email ? (
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.chipText, { color: theme.text }]}>{user.email}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Active Subtasks */}
        {activeTasks.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Active ({activeTasks.length})</Text>
            {activeTasks.map((sub) => {
              const typeInfo = getSubtaskType(sub.type);
              return (
                <View key={sub.id} style={styles.subtaskRow}>
                  <Pressable onPress={() => handleToggleSubtask(sub.id)}>
                    <View style={[styles.subtaskCircle, { borderColor: theme.textSecondary }]} />
                  </Pressable>
                  <TextInput
                    style={[styles.subtaskInput, { color: theme.text }]}
                    value={sub.title}
                    onChangeText={(text) => handleUpdateSubtaskTitle(sub.id, text)}
                    onBlur={() => saveMatter({ subtasks })}
                  />
                  <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                  </View>
                  <Pressable onPress={() => handleDeleteSubtask(sub.id)} style={styles.deleteBtn}>
                    <Ionicons name="close" size={16} color={theme.textSecondary} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {/* Done Subtasks */}
        {doneTasks.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Done ({doneTasks.length})</Text>
            {doneTasks.map((sub) => {
              const typeInfo = getSubtaskType(sub.type);
              return (
                <View key={sub.id} style={styles.subtaskRow}>
                  <Pressable onPress={() => handleToggleSubtask(sub.id)}>
                    <View style={[styles.subtaskCircle, { borderColor: '#34C759', backgroundColor: '#34C759' }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  </Pressable>
                  <TextInput
                    style={[styles.subtaskInput, { color: theme.textSecondary, textDecorationLine: 'line-through' }]}
                    value={sub.title}
                    onChangeText={(text) => handleUpdateSubtaskTitle(sub.id, text)}
                    onBlur={() => saveMatter({ subtasks })}
                  />
                  <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                  </View>
                  <Pressable onPress={() => handleDeleteSubtask(sub.id)} style={styles.deleteBtn}>
                    <Ionicons name="close" size={16} color={theme.textSecondary} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {/* Add Subtask */}
        <View style={styles.addRow}>
          <Pressable onPress={() => setShowTypePicker(true)}>
            <View style={[styles.typeBadge, { backgroundColor: getSubtaskType(newSubtaskType).color + '20' }]}>
              <Text style={[styles.typeBadgeText, { color: getSubtaskType(newSubtaskType).color }]}>
                {getSubtaskType(newSubtaskType).label} ▾
              </Text>
            </View>
          </Pressable>
          <TextInput
            style={[styles.addInput, { color: theme.text }]}
            value={newSubtask}
            onChangeText={setNewSubtask}
            onSubmitEditing={handleAddSubtask}
            placeholder="Add subtask"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
          />
          {newSubtask.trim() ? (
            <Pressable onPress={handleAddSubtask} style={styles.addBtn}>
              <Ionicons name="add-circle" size={28} color="#5E6AD2" />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Timeline</Text>

        {motions.length > 0 ? motions.map((m, i) => {
          const md = parseData(m.data);
          return (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: theme.text }]}>{motionLabel(m.action)}</Text>
                <Text style={[styles.timelineMeta, { color: theme.textSecondary }]}>
                  {formatTime(m.time)}
                  {md.title ? ` · ${md.title}` : ''}
                </Text>
              </View>
            </View>
          );
        }) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet</Text>
        )}

      </ScrollView>

      {/* Type Picker Bottom Sheet */}
      <Modal visible={showTypePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 8 }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <Text style={[styles.sheetTitle, { color: theme.text, paddingHorizontal: 20, paddingBottom: 12 }]}>Subtask Type</Text>
            <View style={styles.sheetOptions}>
              {SUBTASK_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.sheetOption, { backgroundColor: newSubtaskType === t.key ? t.color : theme.backgroundElement }]}
                  onPress={() => { setNewSubtaskType(t.key); setShowTypePicker(false); }}>
                  <Text style={[styles.sheetOptionText, { color: newSubtaskType === t.key ? '#fff' : theme.text }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + 8 }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.menuOptions}>
              <Pressable style={styles.menuOption} onPress={() => { setShowMenu(false); router.push('/settings'); }}>
                <Ionicons name="settings-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Settings</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  titleInput: { flex: 1, fontSize: 22, fontWeight: '600', paddingVertical: 0 },
  menuBtn: { padding: 8 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  subtaskCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  subtaskInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  addInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  addBtn: { padding: 2 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 24 },
  sheetOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sheetOptionText: { fontSize: 14, fontWeight: '500' },
  menuOptions: { paddingHorizontal: 20, paddingVertical: 16 },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  menuOptionText: { fontSize: 16, fontWeight: '500' },
});
