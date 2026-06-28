import { useState } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tarflue } from '@/lib/tarflue';
import { getSelfId } from '@/lib/db';

type EntityType = 'people' | 'work' | 'store' | 'task' | 'lead' | 'product';

const ENTITY_TYPES: { key: EntityType; label: string; icon: string; color: string }[] = [
  { key: 'people', label: 'People', icon: 'person-outline', color: '#5E6AD2' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline', color: '#FF9500' },
  { key: 'store', label: 'Store', icon: 'storefront-outline', color: '#10B981' },
  { key: 'task', label: 'Task', icon: 'checkbox-outline', color: '#8B5CF6' },
  { key: 'lead', label: 'Lead', icon: 'person-add-outline', color: '#EF4444' },
  { key: 'product', label: 'Product', icon: 'cube-outline', color: '#06B6D4' },
];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<EntityType>('people');
  const [title, setTitle] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setCreating(true);

    try {
      const userId = await getSelfId();
      const scope = `user_${userId}`;

      await tarflue.tools.createMatter({
        table: 'matter',
        scope,
        type: selectedType,
        title: title.trim(),
      });

      await tarflue.tools.setAttr({
        matterId: `${selectedType}_${Date.now()}`,
        key: 'status',
        val: 'active',
        scope,
      });

      router.back();
    } catch (e) {
      console.error('[Add] Create failed:', e);
    } finally {
      setCreating(false);
    }
  };

  const handleAiCreate = async () => {
    if (!aiInput.trim()) return;
    setCreating(true);

    try {
      const response = await tarflue.agents.chat(aiInput);
      router.back();
    } catch (e) {
      console.error('[Add] AI create failed:', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={creating}>
          {creating ? (
            <ActivityIndicator size="small" color="#5E6AD2" />
          ) : (
            <Text style={{ color: title.trim() ? '#5E6AD2' : theme.textSecondary, fontSize: 16, fontWeight: '600' }}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

        {/* AI Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>What do you want to create?</Text>
          <View style={[styles.aiInputRow, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              style={[styles.aiInput, { color: theme.text }]}
              value={aiInput}
              onChangeText={setAiInput}
              placeholder="Ask AI to create anything..."
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={handleAiCreate}
            />
            <Pressable style={styles.aiGoBtn} onPress={handleAiCreate} disabled={!aiInput.trim() || creating}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Type Selection */}
        <View style={styles.typeRow}>
          {ENTITY_TYPES.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.typeCard, { backgroundColor: selectedType === t.key ? t.color + '20' : theme.backgroundElement, borderColor: selectedType === t.key ? t.color : 'transparent' }]}
              onPress={() => setSelectedType(t.key)}>
              <Ionicons name={t.icon as any} size={24} color={selectedType === t.key ? t.color : theme.textSecondary} />
              <Text style={[styles.typeLabel, { color: selectedType === t.key ? t.color : theme.text }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Name Input */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Name</Text>
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder={`Enter ${selectedType} name`}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
        </View>

      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingVertical: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { paddingVertical: 8 },
  scrollView: { flex: 1 },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  nameInput: { fontSize: 22, fontWeight: '600', paddingVertical: 8 },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  aiInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  aiGoBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#5E6AD2', justifyContent: 'center', alignItems: 'center' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 20, gap: 8 },
  typeCard: { paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', gap: 6, borderWidth: 2, minWidth: 80 },
  typeLabel: { fontSize: 12, fontWeight: '600' },
});
