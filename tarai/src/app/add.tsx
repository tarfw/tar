import { useState } from 'react';
import { StyleSheet, Pressable, View, TextInput, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';

type EntityType = 'people' | 'work';

const ENTITY_TYPES: { key: EntityType; label: string; icon: string; color: string }[] = [
  { key: 'people', label: 'People', icon: 'person-outline', color: '#5E6AD2' },
  { key: 'work', label: 'Work', icon: 'briefcase-outline', color: '#FF9500' },
];

export default function AddScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();

  const [selectedType, setSelectedType] = useState<EntityType>('people');
  const [title, setTitle] = useState('');

  const handleSave = async () => {
    if (!title.trim()) return;
    const id = `form_${selectedType}_${Date.now()}`;
    const now = new Date().toISOString();

    const formType = selectedType === 'people' ? 'profile' : 'team';
    const scope = selectedType === 'work' ? `t:team_${Date.now()}` : 'p';

    await db.runAsync(
      'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      id, formType, title.trim(), scope, '{}', now
    );

    router.replace({ pathname: '/entity', params: { id } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={{ color: title.trim() ? '#5E6AD2' : theme.textSecondary, fontSize: 16, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

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
            placeholder={selectedType === 'people' ? 'Enter name' : 'Enter work name'}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            {selectedType === 'people'
              ? 'Add people to track CRM, HR, and tasks'
              : 'Add work spaces to organize teams and projects'}
          </Text>
        </View>

      </ScrollView>
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
  typeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  typeCard: { flex: 1, paddingVertical: 20, borderRadius: 12, alignItems: 'center', gap: 8, borderWidth: 2 },
  typeLabel: { fontSize: 14, fontWeight: '600' },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  nameInput: { fontSize: 22, fontWeight: '600', paddingVertical: 8 },
  infoCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, padding: 14, borderRadius: 12, gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
