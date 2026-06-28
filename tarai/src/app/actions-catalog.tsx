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
  FlatList,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useEmbeddings } from '@/db/embeddings-provider';
import {
  searchActions,
  createCustomAction,
  loadAllActions,
  loadPublicActions,
import { toolSearchMemory } from '@/tools/core/search_memory';
import { generateActionDefinition } from '@/lib/ai';
import ActionForm from '@/components/ActionForm';

// Flue: ActionDef and ActionSearchResult now use Flue primitives
type ActionDef = { id: string; name: string; description: string; fields?: any[]; [key: string]: any };
type ActionSearchResult = { action: ActionDef; similarity: number };

async function searchActions(query: string, limit = 5): Promise<ActionSearchResult[]> {
  const results = await toolSearchMemory.run({ input: { query, limit }, signal: new AbortController().signal });
  return results.map((r: any) => ({ action: { id: r.id, name: r.meta?.title || r.id, description: r.text }, similarity: r.similarity }));
}

async function loadAllActions(): Promise<ActionDef[]> { return []; }
async function loadPublicActions(): Promise<ActionDef[]> { return []; }
async function shareAction(id: string) {}
async function deleteAction(id: string) {}
async function importAction(action: ActionDef) {}
async function createCustomAction(action: ActionDef) {}

type ViewMode = 'list' | 'search' | 'create' | 'public' | 'menu';

export default function ActionsCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { isReady, isLoading, downloadProgress } = useEmbeddings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ActionSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionDef | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [createInput, setCreateInput] = useState('');
  const [generating, setGenerating] = useState(false);

  const [allActions, setAllActions] = useState<ActionDef[]>([]);
  const [publicActions, setPublicActions] = useState<ActionDef[]>([]);

  useEffect(() => {
    if (isReady) {
      loadAllActions().then(setAllActions).catch(() => {});
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
      const hits = await searchActions(trimmed);
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
      const def = await generateActionDefinition(input);
      await createCustomAction(def);
      const updated = await loadAllActions();
      setAllActions(updated);
      setSelectedAction(def);
      setViewMode('list');
      setCreateInput('');
    } catch {
      Alert.alert('Generation failed', 'Could not generate an action. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [createInput]);

  const handleLoadPublic = useCallback(async () => {
    try {
      const pubs = await loadPublicActions();
      setPublicActions(pubs);
      setViewMode('public');
    } catch {
      Alert.alert('Error', 'Could not load public actions.');
    }
  }, []);

  const handleImport = useCallback(async (action: ActionDef) => {
    try {
      await importAction(action);
      const updated = await loadAllActions();
      setAllActions(updated);
      Alert.alert('Imported', `"${action.name}" added to your actions.`);
    } catch {
      Alert.alert('Error', 'Could not import action.');
    }
  }, []);

  const handleShare = useCallback(async (action: ActionDef) => {
    try {
      await shareAction(action.id);
      Alert.alert('Shared', `"${action.name}" is now public.`);
    } catch {
      Alert.alert('Error', 'Could not share action.');
    }
  }, []);

  const handleDelete = useCallback((action: ActionDef) => {
    Alert.alert('Delete Action', `Delete "${action.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteAction(action.id);
            const updated = await loadAllActions();
            setAllActions(updated);
          } catch {
            Alert.alert('Error', 'Could not delete action.');
          }
        },
      },
    ]);
  }, []);

  const getData = useCallback(() => {
    if (viewMode === 'public') {
      return publicActions;
    }
    if (results.length > 0) {
      return results;
    }
    return allActions;
  }, [viewMode, publicActions, results, allActions]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (viewMode === 'public') {
      const action = item as ActionDef;
      return (
        <View style={styles.skillRow}>
          <View style={styles.skillInfo}>
            <Text style={[styles.skillName, { color: '#000000' }]} numberOfLines={1}>{action.name}</Text>
            <Text style={[styles.skillDesc, { color: '#8E8E93' }]} numberOfLines={1}>{action.description}</Text>
          </View>
          <Pressable style={styles.importBtn} onPress={() => handleImport(action)}>
            <Text style={styles.importBtnText}>Use</Text>
          </Pressable>
        </View>
      );
    }

    if (results.length > 0) {
      const r = item as ActionSearchResult;
      return (
        <Pressable
          style={({ pressed }) => [styles.skillRow, pressed && { opacity: 0.7 }]}
          onPress={() => setSelectedAction(r.action)}
        >
          <View style={styles.skillInfo}>
            <Text style={[styles.skillName, { color: '#000000' }]}>{r.action.name}</Text>
            <Text style={[styles.skillDesc, { color: '#8E8E93' }]} numberOfLines={1}>{r.action.description}</Text>
          </View>
          <Text style={[styles.skillScore, { color: '#8E8E93' }]}>{Math.round(r.similarity * 100)}%</Text>
        </Pressable>
      );
    }

    const action = item as ActionDef;
    return (
      <Pressable
        style={({ pressed }) => [styles.skillRow, pressed && { opacity: 0.7 }]}
        onPress={() => setSelectedAction(action)}
      >
        <View style={styles.skillInfo}>
          <Text style={[styles.skillName, { color: '#000000' }]}>{action.name}</Text>
          <Text style={[styles.skillDesc, { color: '#8E8E93' }]} numberOfLines={1}>{action.description}</Text>
        </View>
        <View style={styles.skillActions}>
          <Pressable onPress={() => handleShare(action)} style={styles.actionBtn}>
            <Ionicons name="globe-outline" size={16} color="#8E8E93" />
          </Pressable>
          <Pressable onPress={() => handleDelete(action)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      </Pressable>
    );
  }, [viewMode, results.length, handleImport, handleShare, handleDelete]);

  if (selectedAction) {
    return (
      <ActionForm
        action={selectedAction}
        onDone={() => { setSelectedAction(null); setQuery(''); setResults([]); router.back(); }}
        onCancel={() => setSelectedAction(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#ffffff', paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
        </Pressable>
        <Text style={[styles.title, { color: '#000000' }]}>Actions</Text>
        <Pressable style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]} onPress={() => setViewMode(viewMode === 'menu' ? 'list' : 'menu')}>
          <Ionicons name={viewMode === 'menu' ? 'close' : 'add-circle-outline'} size={26} color="#5E6AD2" />
        </Pressable>
      </View>

      {viewMode === 'menu' && (
        <View style={[styles.menu, { backgroundColor: '#F2F2F7' }]}>
          <Pressable style={styles.menuItem} onPress={() => { setViewMode('create'); }}>
            <Text style={[styles.menuText, { color: '#000000' }]}>Create with AI</Text>
          </Pressable>
          <View style={[styles.menuSep, { backgroundColor: '#E5E5EA' }]} />
          <Pressable style={styles.menuItem} onPress={handleLoadPublic}>
            <Text style={[styles.menuText, { color: '#000000' }]}>Browse Public Actions</Text>
          </Pressable>
        </View>
      )}

      {viewMode === 'create' && (
        <View style={[styles.createBar, { backgroundColor: '#F2F2F7' }]}>
          <TextInput
            style={[styles.createInput, { color: '#000000' }]}
            placeholder="Describe the action you need..."
            placeholderTextColor="#8E8E93"
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

      <View style={[styles.searchBar, { backgroundColor: '#F2F2F7' }]}>
        <Ionicons name="search-outline" size={18} color="#8E8E93" />
        <TextInput
          style={[styles.input, { color: '#000000' }]}
          placeholder="Search actions..."
          placeholderTextColor="#8E8E93"
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoFocus={viewMode !== 'create'}
          editable={isReady}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); if (debounceRef.current) clearTimeout(debounceRef.current); }}>
            <Ionicons name="close-circle" size={18} color="#8E8E93" />
          </Pressable>
        )}
      </View>

      {!isReady ? (
        <View style={styles.center}>
          {isLoading ? (
            <>
              <ActivityIndicator color="#8E8E93" />
              <Text style={[styles.hint, { color: '#8E8E93' }]}>Downloading model... {Math.round(downloadProgress * 100)}%</Text>
            </>
          ) : (
            <>
              <Text style={[styles.hint, { color: '#8E8E93' }]}>The embedding model is not loaded yet.</Text>
              <Pressable style={({ pressed }) => [styles.settingsBtn, { backgroundColor: '#F2F2F7' }, pressed && { opacity: 0.6 }]} onPress={() => router.push('/settings' as any)}>
                <Text style={[styles.settingsBtnText, { color: '#000000' }]}>Go to Settings to download</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : searching ? (
        <View style={styles.center}><ActivityIndicator color="#8E8E93" /></View>
      ) : (
        <FlatList
          data={getData()}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if (viewMode === 'public') return (item as ActionDef).id;
            if (results.length > 0) return (item as ActionSearchResult).action.id;
            return (item as ActionDef).id;
          }}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96, backgroundColor: '#ffffff' }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={() => {
            if (viewMode === 'public') {
              return <Text style={styles.sectionTitle}>Public Actions</Text>;
            }
            if (results.length > 0) {
              return null;
            }
            return <Text style={styles.sectionTitle}>My Actions</Text>;
          }}
          ListFooterComponent={() => {
            if (viewMode === 'public') {
              return (
                <Pressable style={styles.backToList} onPress={() => setViewMode('list')}>
                  <Text style={styles.backToListText}>Back to My Actions</Text>
                </Pressable>
              );
            }
            return null;
          }}
          ListEmptyComponent={() => {
            if (query.length > 0) {
              return <Text style={styles.empty}>No matching actions found.{'\n'}Try different keywords, or create a new action.</Text>;
            }
            if (viewMode === 'public') {
              return <Text style={styles.empty}>No public actions available yet.</Text>;
            }
            return <Text style={styles.empty}>No actions yet. Create one with AI.</Text>;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 44, backgroundColor: '#ffffff' },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600', color: '#000000' },
  menu: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F2F2F7' },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { fontSize: 15, color: '#000000' },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E5EA' },
  createBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 44, borderRadius: 10, backgroundColor: '#F2F2F7' },
  createInput: { flex: 1, fontSize: 15, padding: 0, color: '#000000' },
  generateBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#5E6AD2', justifyContent: 'center', alignItems: 'center' },
  genBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 10, backgroundColor: '#F2F2F7' },
  input: { flex: 1, fontSize: 16, padding: 0, color: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32, backgroundColor: '#ffffff' },
  hint: { fontSize: 15, textAlign: 'center', color: '#8E8E93' },
  settingsBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4, backgroundColor: '#F2F2F7' },
  settingsBtnText: { fontSize: 15, fontWeight: '500', color: '#000000' },
  scroll: { flex: 1, backgroundColor: '#ffffff' },
  skillRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA', gap: 12, backgroundColor: '#ffffff' },
  skillInfo: { flex: 1, gap: 2 },
  skillName: { fontSize: 16, fontWeight: '500', color: '#000000' },
  skillDesc: { fontSize: 13, color: '#8E8E93' },
  skillScore: { fontSize: 13, fontWeight: '500', color: '#8E8E93' },
  skillActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  importBtn: { backgroundColor: '#5E6AD2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  importBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  backToList: { marginTop: 24, marginBottom: 16, alignItems: 'center', backgroundColor: '#ffffff' },
  backToListText: { fontSize: 15, fontWeight: '500', color: '#5E6AD2' },
  empty: { textAlign: 'center', paddingTop: 80, fontSize: 15, paddingHorizontal: 32, lineHeight: 22, color: '#8E8E93', backgroundColor: '#ffffff' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, color: '#8E8E93', backgroundColor: '#ffffff' },
});
