import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById } from '@/hooks/use-form';

export default function DetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();
  const params = useLocalSearchParams<{ type: string; id: string; title: string }>();
  const { row, loading } = useFormById(params.id);

  const [localTitle, setLocalTitle] = useState(params.title || '');
  const [localFields, setLocalFields] = useState<{ key: string; label: string; value: string }[]>([]);

  const syncFromRow = useCallback(() => {
    if (!row) return;
    setLocalTitle(row.title);
    const d = JSON.parse(row.data);
    const f: { key: string; label: string; value: string }[] = [];
    for (const [k, v] of Object.entries(d)) {
      f.push({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), value: String(v) });
    }
    setLocalFields(f);
  }, [row]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { syncFromRow(); }, [syncFromRow]);

  const handleSave = async () => {
    if (!row) return;
    const data: Record<string, any> = {};
    for (const f of localFields) data[f.key] = f.value;
    console.log(`[DETAIL] SAVE id=${row.id} title="${localTitle}" data=`, data);
    await db.runAsync('UPDATE form SET title = ?, data = ? WHERE id = ?', localTitle, JSON.stringify(data), row.id);
    console.log(`[DETAIL] SAVE OK`);
    router.back();
  };

  const handleDelete = async () => {
    if (!row) return;
    console.log(`[DETAIL] DELETE id=${row.id}`);
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', row.id);
    console.log(`[DETAIL] DELETE OK`);
    router.back();
  };

  if (loading) {
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
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: '#007AFF', fontSize: 18 }}>{'\u2039'} Back</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Not found</Text>
          <View style={{ width: 50 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: '#007AFF', fontSize: 18 }}>{'\u2039'} Back</Text>
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Edit</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Title</Text>
          <TextInput style={[styles.titleInput, { color: theme.text }]} value={localTitle} onChangeText={setLocalTitle} placeholder="Enter title" placeholderTextColor={theme.textSecondary} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Type</Text>
          <Text style={[styles.fieldInput, { color: theme.textSecondary }]}>{row.type}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Scope</Text>
          <Text style={[styles.fieldInput, { color: theme.textSecondary }]}>{row.scope}</Text>
        </View>

        {localFields.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{field.label}</Text>
            <TextInput
              style={[styles.fieldInput, { color: theme.text }]}
              value={field.value}
              onChangeText={(v) => setLocalFields(localFields.map(f => f.key === field.key ? { ...f, value: v } : f))}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        ))}

        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]} onPress={handleDelete}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Archive</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]} onPress={handleDelete}>
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '500' }}>Delete</Text>
          </Pressable>
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
  fieldInput: { fontSize: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 32, gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
});
