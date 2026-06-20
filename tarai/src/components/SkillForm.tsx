import { useState } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  TextInput,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import type { SkillDef, SkillField } from '@/skills/definitions';
import { executeSkill } from '@/skills/executor';

interface Props {
  skill: SkillDef;
  onDone: () => void;
  onCancel: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={n <= value ? '#FFB800' : '#999'}
          />
        </Pressable>
      ))}
    </View>
  );
}

function SelectField({ field, value, onChange, theme }: { field: SkillField; value: string; onChange: (v: string) => void; theme: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        style={[styles.selectBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border || '#333' }]}
        onPress={() => setOpen(!open)}>
        <Text style={{ color: value ? theme.text : theme.textSecondary, fontSize: 15 }}>
          {value || field.placeholder || 'Select...'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>
      {open && field.options?.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.selectOption, { backgroundColor: value === opt ? theme.backgroundElement : 'transparent' }]}
          onPress={() => { onChange(opt); setOpen(false); }}>
          <Text style={{ color: theme.text, fontSize: 14, textTransform: 'capitalize' }}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SkillForm({ skill, onDone, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const set = (name: string, val: any) => setValues((v) => ({ ...v, [name]: val }));

  const handleSave = async () => {
    const missing = skill.fields.filter((f) => f.required && !values[f.name]);
    if (missing.length > 0) {
      Alert.alert('Required fields', `Please fill: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      await executeSkill(db, skill, values);
      console.log(`[SKILLS] ✓ ${skill.name} saved`);
      onDone();
    } catch (e) {
      console.error('[SKILLS] save failed:', e);
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <Pressable onPress={onCancel} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name={skill.icon as any} size={18} color={theme.text} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>{skill.name}</Text>
        </View>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={{ color: saving ? theme.textSecondary : '#5E6AD2', fontSize: 16, fontWeight: '600' }}>
            {saving ? '...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled">

          {skill.fields.map((field) => (
            <View key={field.name} style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {field.label} {field.required ? '*' : ''}
              </Text>

              {field.type === 'select' ? (
                <SelectField field={field} value={values[field.name] || ''} onChange={(v) => set(field.name, v)} theme={theme} />
              ) : field.type === 'textarea' ? (
                <TextInput
                  style={[styles.textarea, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  value={values[field.name] || ''}
                  onChangeText={(t) => set(field.name, t)}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
              ) : field.type === 'rating' ? (
                <StarRating value={values[field.name] || 0} onChange={(v) => set(field.name, v)} />
              ) : (
                <TextInput
                  style={[styles.textInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  value={values[field.name] || ''}
                  onChangeText={(t) => set(field.name, t)}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType={field.type === 'number' ? 'numeric' : field.type === 'phone' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'}
                  autoFocus={field === skill.fields[0]}
                />
              )}
            </View>
          ))}

          <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>{skill.description}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  textInput: { fontSize: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  textarea: { fontSize: 15, lineHeight: 20, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, minHeight: 100 },
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  selectOption: { paddingVertical: 10, paddingHorizontal: 28 },
  infoCard: { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, padding: 12, borderRadius: 10, gap: 8, alignItems: 'flex-start' },
  infoText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
