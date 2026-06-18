import { useState } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useMotion } from '@/hooks/use-motion';

type FormType = 'team' | 'product' | 'project' | 'task' | 'note' | 'template' | 'profile' | 'ticket';

const TYPES: { type: FormType; label: string }[] = [
  { type: 'team', label: 'Team' },
  { type: 'product', label: 'Product' },
  { type: 'project', label: 'Project' },
  { type: 'task', label: 'Task' },
  { type: 'note', label: 'Note' },
  { type: 'template', label: 'Template' },
  { type: 'profile', label: 'Member' },
  { type: 'ticket', label: 'Ticket' },
];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const { emit } = useMotion();
  const [selectedType, setSelectedType] = useState<FormType>('note');
  const [title, setTitle] = useState('');

  const handleSave = async () => {
    if (!title.trim()) return;
    const id = `form_${selectedType}_${Date.now()}`;
    const now = new Date().toISOString();

    // Teams get their own scope; members get the selected team's scope
    let scope = 'p';
    if (selectedType === 'team') {
      scope = `t:team_${Date.now()}`;
    } else if (selectedType === 'profile') {
      scope = 'p'; // default, workspace screen will assign proper scope
    }

    console.log(`[ADD] Creating ${selectedType}: "${title.trim()}" scope=${scope}`);

    // Insert form
    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, selectedType, title.trim(), scope, '{}', now
    );
    console.log(`[ADD] Form created: ${id}`);

    // Emit motion entry
    const actionCode = selectedType === 'task' ? 100
      : selectedType === 'ticket' ? 306
      : 100; // ENTITY_CREATED
    await emit(id, actionCode, {
      title: title.trim(),
      vertical: selectedType.charAt(0).toUpperCase() + selectedType.slice(1),
      scope: title.trim(),
      urgency: 'Now',
    });

    console.log(`[ADD] Motion emitted for ${id}`);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: '#007AFF', fontSize: 18 }}>{'\u2039'} Back</Text>
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>New</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={{ color: title.trim() ? '#007AFF' : theme.textSecondary, fontSize: 16, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Type</Text>
          <View style={styles.typeGrid}>
            {TYPES.map((t) => (
              <Pressable
                key={t.type}
                style={[styles.typeChip, { backgroundColor: selectedType === t.type ? '#5E6AD2' : theme.backgroundElement }]}
                onPress={() => setSelectedType(t.type)}>
                <Text style={[styles.typeChipText, { color: selectedType === t.type ? '#ffffff' : theme.text }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Title</Text>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder={`Enter ${selectedType} title`}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingVertical: 8 },
  saveBtn: { paddingVertical: 8 },
  scrollView: { flex: 1 },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  titleInput: { fontSize: 24, fontWeight: '600', paddingVertical: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  typeChipText: { fontSize: 14, fontWeight: '500' },
});
