import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Pressable,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useEmbeddings } from '@/db/embeddings-provider';
import {
  searchSkills,
  createCustomSkill,
  loadAllSkills,
  loadPublicSkills,
  shareSkill,
  deleteSkill,
  importSkill,
  type SkillSearchResult,
} from '@/skills/store';
import type { SkillDef } from '@/skills/definitions';
import { generateSkillDefinition } from '@/lib/ai';
import SkillForm from '@/components/SkillForm';

type ViewMode = 'list' | 'search' | 'create' | 'public' | 'menu';

export default function SkillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isReady, isLoading, downloadProgress } = useEmbeddings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillDef | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [createInput, setCreateInput] = useState('');
  const [generating, setGenerating] = useState(false);

  const [allSkills, setAllSkills] = useState<SkillDef[]>([]);
  const [publicSkills, setPublicSkills] = useState<SkillDef[]>([]);

  useEffect(() => {
    if (isReady) {
      loadAllSkills().then(setAllSkills).catch(() => {});
    }
  }, [isReady]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  const liveSearch = useCallback(async (q: string, seq: number) => {
    const trimmed = q.trim();
    if (!trimmed || !isReady) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchSkills(trimmed);
      if (seq === searchSeqRef.current) setResults(hits);
    } catch {
      if (seq === searchSeqRef.current) setResults([]);
    } finally {
      if (seq === searchSeqRef.current) setSearching(false);
    }
  }, [isReady]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(() => liveSearch(text, seq), 300);
  }, [liveSearch]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleGenerate = useCallback(async () => {
    const input = createInput.trim();
    if (!input) return;
    Keyboard.dismiss();
    setGenerating(true);
    try {
      const def = await generateSkillDefinition(input);
      await createCustomSkill(def);
      const updated = await loadAllSkills();
      setAllSkills(updated);
      setSelectedSkill(def);
      setViewMode('list');
      setCreateInput('');
    } catch {
      Alert.alert('Generation failed', 'Could not generate a skill. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [createInput]);

  const handleLoadPublic = useCallback(async () => {
    try {
      const pubs = await loadPublicSkills();
      setPublicSkills(pubs);
      setViewMode('public');
    } catch {
      Alert.alert('Error', 'Could not load public skills.');
    }
  }, []);

  const handleImport = useCallback(async (skill: SkillDef) => {
    try {
      await importSkill(skill.id);
      const updated = await loadAllSkills();
      setAllSkills(updated);
      Alert.alert('Imported', `"${skill.name}" added to your skills.`);
    } catch {
      Alert.alert('Error', 'Could not import skill.');
    }
  }, []);

  const handleShare = useCallback(async (skill: SkillDef) => {
    try {
      await shareSkill(skill.id);
      Alert.alert('Shared', `"${skill.name}" is now public.`);
    } catch {
      Alert.alert('Error', 'Could not share skill.');
    }
  }, []);

  const handleDelete = useCallback((skill: SkillDef) => {
    Alert.alert('Delete Skill', `Delete "${skill.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteSkill(skill.id);
            const updated = await loadAllSkills();
            setAllSkills(updated);
          } catch {
            Alert.alert('Error', 'Could not delete skill.');
          }
        },
      },
    ]);
  }, []);

  if (selectedSkill) {
    return (
      <SkillForm
        skill={selectedSkill}
        onDone={() => { setSelectedSkill(null); setQuery(''); setResults([]); router.back(); }}
        onCancel={() => setSelectedSkill(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Skills</Text>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} onPress={() => setViewMode(viewMode === 'menu' ? 'list' : 'menu')}>
          <Ionicons name={viewMode === 'menu' ? 'close' : 'add-circle-outline'} size={26} color="#5E6AD2" />
        </Pressable>
      </View>

      {viewMode === 'menu' && (
        <View style={[styles.menu, { backgroundColor: theme.backgroundElement }]}>
          <Pressable style={styles.menuItem} onPress={() => { setViewMode('create'); }}>
            <Text style={[styles.menuText, { color: theme.text }]}>Create with AI</Text>
          </Pressable>
          <View style={[styles.menuSep, { backgroundColor: theme.background }]} />
          <Pressable style={styles.menuItem} onPress={handleLoadPublic}>
            <Text style={[styles.menuText, { color: theme.text }]}>Browse Public Skills</Text>
          </Pressable>
        </View>
      )}

      {viewMode === 'create' && (
        <View style={[styles.createBar, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.createInput, { color: theme.text }]}
            placeholder="Describe the skill you need..."
            placeholderTextColor={theme.textSecondary}
            value={createInput}
            onChangeText={setCreateInput}
            onSubmitEditing={handleGenerate}
            returnKeyType="done"
            autoFocus
            editable={!generating}
          />
          <Pressable
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.7 }]}
            onPress={handleGenerate}
            disabled={generating || !createInput.trim()}>
            {generating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.genBtnText}>Go</Text>}
          </Pressable>
        </View>
      )}

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Search skills..."
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoFocus={viewMode !== 'create'}
          editable={isReady}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); if (debounceRef.current) clearTimeout(debounceRef.current); }}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {!isReady ? (
        <View style={styles.center}>
          {isLoading ? (
            <>
              <ActivityIndicator color={theme.textSecondary} />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>Downloading model... {Math.round(downloadProgress * 100)}%</Text>
            </>
          ) : (
            <>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>The embedding model is not loaded yet.</Text>
              <Pressable style={({ pressed }) => [styles.settingsBtn, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.6 }]} onPress={() => router.push('/settings')}>
                <Text style={[styles.settingsBtnText, { color: theme.text }]}>Go to Settings to download</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : searching ? (
        <View style={styles.center}><ActivityIndicator color={theme.textSecondary} /></View>
      ) : (
        <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 96 }} keyboardShouldPersistTaps="handled">

          {viewMode === 'public' ? (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Public Skills</Text>
              {publicSkills.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textSecondary }]}>No public skills available yet.</Text>
              ) : publicSkills.map((skill) => (
                <View key={skill.id} style={[styles.skillRow, { backgroundColor: theme.backgroundElement }]}>
                  <View style={styles.skillInfo}>
                    <Text style={[styles.skillName, { color: theme.text }]} numberOfLines={1}>{skill.name}</Text>
                    <Text style={[styles.skillDesc, { color: theme.textSecondary }]} numberOfLines={1}>{skill.description}</Text>
                  </View>
                  <Pressable style={styles.importBtn} onPress={() => handleImport(skill)}>
                    <Text style={styles.importBtnText}>Use</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.backToList} onPress={() => setViewMode('list')}>
                <Text style={[styles.backToListText, { color: '#5E6AD2' }]}>Back to My Skills</Text>
              </Pressable>
            </View>
          ) : results.length > 0 ? (
            results.map((r) => (
              <Pressable key={r.skill.id} style={({ pressed }) => [styles.skillRow, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]} onPress={() => setSelectedSkill(r.skill)}>
                <View style={styles.skillInfo}>
                  <Text style={[styles.skillName, { color: theme.text }]} numberOfLines={1}>{r.skill.name}</Text>
                  <Text style={[styles.skillDesc, { color: theme.textSecondary }]} numberOfLines={1}>{r.skill.description}</Text>
                </View>
                <Text style={[styles.skillScore, { color: theme.textSecondary }]}>{Math.round(r.similarity * 100)}%</Text>
              </Pressable>
            ))
          ) : query.length > 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>No matching skills found.{'\n'}Try different keywords, or create a new skill.</Text>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>My Skills</Text>
              {allSkills.map((skill) => (
                <View key={skill.id}>
                  <Pressable style={({ pressed }) => [styles.skillRow, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]} onPress={() => setSelectedSkill(skill)}>
                    <View style={styles.skillInfo}>
                      <Text style={[styles.skillName, { color: theme.text }]}>{skill.name}</Text>
                      <Text style={[styles.skillDesc, { color: theme.textSecondary }]} numberOfLines={1}>{skill.description}</Text>
                    </View>
                    <View style={styles.skillActions}>
                      <Pressable onPress={() => handleShare(skill)} style={styles.actionBtn}>
                        <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(skill)} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </Pressable>
                </View>
              ))}
              {allSkills.length === 0 && (
                <Text style={[styles.empty, { color: theme.textSecondary }]}>No skills yet. Create one with AI.</Text>
              )}
            </View>
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 44 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  menu: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, overflow: 'hidden' },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontSize: 15 },
  menuSep: { height: StyleSheet.hairlineWidth },
  createBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 44, borderRadius: 10 },
  createInput: { flex: 1, fontSize: 15, padding: 0 },
  generateBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#5E6AD2', justifyContent: 'center', alignItems: 'center' },
  genBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 10 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  hint: { fontSize: 15, textAlign: 'center' },
  settingsBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  settingsBtnText: { fontSize: 15, fontWeight: '500' },
  scroll: { flex: 1 },
  skillRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, gap: 12 },
  skillInfo: { flex: 1, gap: 2 },
  skillName: { fontSize: 16, fontWeight: '500' },
  skillDesc: { fontSize: 13 },
  skillScore: { fontSize: 13, fontWeight: '500' },
  skillActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  importBtn: { backgroundColor: '#5E6AD2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  importBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  backToList: { marginTop: 16, alignItems: 'center' },
  backToListText: { fontSize: 15, fontWeight: '500' },
  empty: { textAlign: 'center', paddingTop: 80, fontSize: 15, paddingHorizontal: 32, lineHeight: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
});
