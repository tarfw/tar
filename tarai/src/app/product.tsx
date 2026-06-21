import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { suggestProductDetails } from '@/lib/ai';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

export default function ProductScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; mode?: 'create' | 'edit' }>();
  const isNew = params.mode === 'create' || !params.id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Product fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState('');
  const [modifiers, setModifiers] = useState('');

  // Stock activity
  const [activities, setActivities] = useState<any[]>([]);

  const loadProduct = useCallback(async () => {
    if (isNew || !params.id) return;
    setLoading(true);
    try {
      const row = await db.getFirstAsync<any>('SELECT * FROM form WHERE id = ?', params.id);
      if (row) {
        setName(row.title || '');
        const data = parseData(row.data);
        setCategory(data.category || '');
        setTags(data.tags || '');
        setDescription(data.description || '');
        setOptions(data.options || '');
        setModifiers(data.modifiers || '');

        // Load stock activity
        const acts = await db.getAllAsync<any>(
          `SELECT mo.*, m.data as item_data FROM motion mo
           JOIN matter m ON m.id = mo.stream
           WHERE m.form = ? ORDER BY mo.time DESC LIMIT 10`,
          params.id
        );
        setActivities(acts);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, isNew, db]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  const handleAiGenerate = async () => {
    if (!name.trim()) return;
    setAiLoading(true);
    try {
      const suggestion = await suggestProductDetails(name.trim());
      if (suggestion.category) setCategory(suggestion.category);
      if (suggestion.description) setDescription(suggestion.description);
      if (suggestion.variants.length > 0) setOptions(suggestion.variants.join(', '));
    } catch (e) {
      console.warn('[Product] AI failed:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data = { category, tags, description, options, modifiers };

      if (isNew) {
        const id = `prod_${Date.now()}`;
        await db.runAsync(
          'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
          id, 'product', name.trim(), 'p', JSON.stringify(data), now
        );
      } else {
        await db.runAsync(
          'UPDATE form SET title = ?, data = ? WHERE id = ?',
          name.trim(), JSON.stringify(data), params.id
        );
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isNew ? 'New Product' : 'Product'}
        </Text>
        <Pressable onPress={handleSave} disabled={saving || !name.trim()} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color="#5E6AD2" />
          ) : (
            <Text style={{ color: name.trim() ? '#5E6AD2' : theme.textSecondary, fontSize: 16, fontWeight: '600' }}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Name */}
        <View style={styles.section}>
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Product name"
            placeholderTextColor={theme.textSecondary}
            autoFocus={isNew}
          />
        </View>

        {/* AI Generate */}
        <View style={styles.section}>
          {aiLoading ? (
            <View style={styles.aiRow}>
              <ActivityIndicator size="small" color="#5E6AD2" />
              <Text style={[styles.aiText, { color: theme.textSecondary }]}>Generating...</Text>
            </View>
          ) : (
            <Pressable onPress={handleAiGenerate} disabled={!name.trim()}>
              <Text style={[styles.aiText, { color: name.trim() ? '#5E6AD2' : theme.textSecondary }]}>AI generate</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Category */}
        <View style={styles.section}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={tags}
            onChangeText={setTags}
            placeholder="Tags"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <TextInput
            style={[styles.input, { color: theme.text, height: 60, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        {/* Options */}
        <View style={styles.section}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={options}
            onChangeText={setOptions}
            placeholder="Options (comma separated)"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Modifiers */}
        <View style={styles.section}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={modifiers}
            onChangeText={setModifiers}
            placeholder="Modifiers (comma separated)"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Stock Activity */}
        {!isNew && activities.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.backgroundElement, marginTop: 16 }]} />
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Activity</Text>
            {activities.map((act, i) => (
              <View key={i} style={styles.activityRow}>
                <View style={[styles.dot, { backgroundColor: act.delta < 0 ? '#FF3B30' : '#10B981' }]} />
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: theme.text }]}>
                    {act.delta < 0 ? 'Sold' : 'Restocked'} {Math.abs(act.delta || 0)}
                  </Text>
                  <Text style={[styles.activityMeta, { color: theme.textSecondary }]}>
                    {act.time ? new Date(act.time).toLocaleDateString() : ''}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </KeyboardAwareScrollView>
      <KeyboardToolbar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { padding: 4, minWidth: 50, alignItems: 'flex-end' },
  scrollView: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  nameInput: { fontSize: 24, fontWeight: '600', paddingVertical: 4 },
  input: { fontSize: 16, paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginTop: 8 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiText: { fontSize: 15, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '500' },
  activityMeta: { fontSize: 12, marginTop: 2 },
});
