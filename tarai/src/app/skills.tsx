import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useEmbeddings } from '@/db/embeddings-provider';
import { searchSkills, createCustomSkill, loadAllSkills, type SkillSearchResult } from '@/skills/store';
import type { SkillDef } from '@/skills/definitions';
import { generateSkillDefinition } from '@/lib/ai';
import SkillForm from '@/components/SkillForm';

export default function SkillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isReady, isLoading, downloadProgress } = useEmbeddings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillDef | null>(null);

  // Create flow state
  const [createMode, setCreateMode] = useState(false);
  const [createInput, setCreateInput] = useState('');
  const [generating, setGenerating] = useState(false);

  // All skills for the default list
  const [allSkills, setAllSkills] = useState<SkillDef[]>([]);

  useEffect(() => {
    if (isReady) {
      loadAllSkills().then(setAllSkills).catch(() => {});
    }
  }, [isReady]);

  // Debounced live search — fires on every keystroke after 300ms pause
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
      // Discard if a newer search superseded this one
      if (seq === searchSeqRef.current) {
        setResults(hits);
      }
    } catch (e) {
      console.warn('[Skills] search failed:', e);
      if (seq === searchSeqRef.current) {
        setResults([]);
      }
    } finally {
      if (seq === searchSeqRef.current) {
        setSearching(false);
      }
    }
  }, [isReady]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(() => {
      liveSearch(text, seq);
    }, 300);
  }, [liveSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const input = createInput.trim();
    if (!input) return;
    Keyboard.dismiss();
    setGenerating(true);
    try {
      const def = await generateSkillDefinition(input);
      await createCustomSkill(def);
      // Refresh the list
      const updated = await loadAllSkills();
      setAllSkills(updated);
      // Open the new skill in the form for a first run
      setSelectedSkill(def);
      setCreateMode(false);
      setCreateInput('');
    } catch (e) {
      console.warn('[Skills] generate failed:', e);
      Alert.alert('Generation failed', 'Could not generate a skill. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [createInput]);

  if (selectedSkill) {
    return (
      <SkillForm
        skill={selectedSkill}
        onDone={() => {
          setSelectedSkill(null);
          setQuery('');
          setResults([]);
          router.back();
        }}
        onCancel={() => setSelectedSkill(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Skills</Text>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          onPress={() => setCreateMode(!createMode)}>
          <Ionicons name={createMode ? 'close' : 'add-circle-outline'} size={26} color="#5E6AD2" />
        </Pressable>
      </View>

      {createMode && (
        <View style={[styles.createBar, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.createInput, { color: theme.text }]}
            placeholder="Describe the skill you need…"
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
            {generating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sparkles" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      )}

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Search skills…"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoFocus={!createMode}
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
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Downloading model… {Math.round(downloadProgress * 100)}%
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                The embedding model isn&apos;t loaded yet.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.settingsBtn, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.6 }]}
                onPress={() => router.push('/settings')}>
                <Text style={[styles.settingsBtnText, { color: theme.text }]}>Go to Settings to download</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : searching ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          keyboardShouldPersistTaps="handled">

          {results.length > 0 ? (
            results.map((r) => (
              <Pressable
                key={r.skill.id}
                style={({ pressed }) => [styles.skillRow, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}
                onPress={() => setSelectedSkill(r.skill)}>
                <View style={[styles.skillIcon, { backgroundColor: r.skill.custom ? '#10B98120' : '#5E6AD220' }]}>
                  <Ionicons name={r.skill.icon as any} size={22} color={r.skill.custom ? '#10B981' : '#5E6AD2'} />
                </View>
                <View style={styles.skillInfo}>
                  <Text style={[styles.skillName, { color: theme.text }]} numberOfLines={1}>
                    {r.skill.name} {r.skill.custom ? '✦' : ''}
                  </Text>
                  <Text style={[styles.skillDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                    {r.skill.description}
                  </Text>
                </View>
                <Text style={[styles.skillScore, { color: theme.textSecondary }]}>
                  {Math.round(r.similarity * 100)}%
                </Text>
              </Pressable>
            ))
          ) : query.length > 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              No matching skills found.{'\n'}Try different keywords, or create a new skill above.
            </Text>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>All Skills</Text>
              {allSkills.map((skill) => (
                <Pressable
                  key={skill.id}
                  style={({ pressed }) => [styles.skillRow, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedSkill(skill)}>
                  <View style={[styles.skillIcon, { backgroundColor: skill.custom ? '#10B98120' : '#5E6AD220' }]}>
                    <Ionicons name={skill.icon as any} size={22} color={skill.custom ? '#10B981' : '#5E6AD2'} />
                  </View>
                  <View style={styles.skillInfo}>
                    <Text style={[styles.skillName, { color: theme.text }]}>
                      {skill.name} {skill.custom ? '✦' : ''}
                    </Text>
                    <Text style={[styles.skillDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                      {skill.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
              <Text style={[styles.hint, { color: theme.textSecondary, textAlign: 'center', marginTop: 16 }]}>
                Or type above to search by meaning
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 44 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  createBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 44, borderRadius: 10 },
  createInput: { flex: 1, fontSize: 15, padding: 0 },
  generateBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#5E6AD2', justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 10 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  hint: { fontSize: 15, textAlign: 'center' },
  settingsBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  settingsBtnText: { fontSize: 15, fontWeight: '500' },
  scroll: { flex: 1 },
  skillRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, gap: 12 },
  skillIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  skillInfo: { flex: 1, gap: 2 },
  skillName: { fontSize: 16, fontWeight: '500' },
  skillDesc: { fontSize: 13 },
  skillScore: { fontSize: 13, fontWeight: '500' },
  empty: { textAlign: 'center', paddingTop: 80, fontSize: 15, paddingHorizontal: 32, lineHeight: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
});
