import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useEmbeddings } from '@/db/embeddings-provider';
import {
  searchFormVectorsDetailed,
  upsertFormVector,
  deleteFormVector,
  type VectorSearchResult,
} from '@/lib/vectorStore';

const NOTE_TYPE = 'note';
const NOTE_SCOPE = 'p';

function routeForType(type: string | null): '/entity' | '/workspace' | '/task' | '/detail' {
  switch (type) {
    case 'profile':
      return '/entity';
    case 'team':
      return '/workspace';
    case 'task':
    case 'subtask':
      return '/task';
    default:
      return '/detail';
  }
}

function snippet(data: string | null): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    const text = parsed.body || parsed.description || parsed.note || '';
    return text ? String(text).slice(0, 120) : null;
  } catch {
    return data.slice(0, 120);
  }
}

function bodyFromData(data: string | null): string {
  if (!data) return '';
  try {
    const parsed = JSON.parse(data);
    return String(parsed.body || parsed.description || parsed.note || '');
  } catch {
    return data;
  }
}

type Editing = { id: string; title: string; body: string } | null;

export default function AiSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const { isReady, isLoading, downloadProgress } = useEmbeddings();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VectorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const seqRef = useRef(0);

  // Editor modal state. `editing.id === ''` means a new (create) entry.
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || !isReady) return;
    Keyboard.dismiss();
    const seq = ++seqRef.current;
    console.log(`[AISearch] ▶ search #${seq} q="${q}"`);
    setSearching(true);
    setHasSearched(true);
    try {
      const hits = await searchFormVectorsDetailed(q, 25);
      // Ignore stale responses if a newer search started.
      if (seq === seqRef.current) {
        console.log(`[AISearch] ◀ search #${seq} rendered ${hits.length} result(s)`);
        setResults(hits);
      } else {
        console.log(`[AISearch] ✕ search #${seq} discarded (stale, current #${seqRef.current})`);
      }
    } catch (e) {
      console.warn('[AISearch] search failed:', e);
      if (seq === seqRef.current) setResults([]);
    } finally {
      if (seq === seqRef.current) setSearching(false);
    }
  }, [query, isReady]);

  const handlePressResult = (item: VectorSearchResult) => {
    router.push({ pathname: routeForType(item.type), params: { id: item.formId } });
  };

  const openCreate = () => {
    console.log('[AISearch] ✎ open CREATE editor');
    setEditing({ id: '', title: '', body: '' });
  };

  const openEdit = (item: VectorSearchResult) => {
    console.log(`[AISearch] ✎ open EDIT editor form=${item.formId}`);
    setEditing({ id: item.formId, title: item.title, body: bodyFromData(item.data) });
  };

  // Create or update a note: write to `form`, then (re)index its vector so it
  // becomes semantically searchable. Same path keeps search + storage in sync.
  const handleSave = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    const body = editing.body.trim();
    if (!title) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }
    setSaving(true);
    const isNew = editing.id === '';
    const id = isNew ? `form_${NOTE_TYPE}_${Date.now()}` : editing.id;
    const data = JSON.stringify({ body });
    console.log(`[AISearch] 💾 ${isNew ? 'CREATE' : 'UPDATE'} form=${id} title="${title}" body=${body.length}chars`);
    try {
      if (isNew) {
        const now = new Date().toISOString();
        await db.runAsync(
          'INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, ?, ?, ?, ?, ?, 1)',
          id, NOTE_TYPE, title, NOTE_SCOPE, data, now
        );
        console.log(`[AISearch] 💾 form row inserted → ${id}`);
      } else {
        await db.runAsync('UPDATE form SET title = ?, data = ? WHERE id = ?', title, data, id);
        console.log(`[AISearch] 💾 form row updated → ${id}`);
      }
      // Index/refresh the embedding for this form.
      await upsertFormVector(id, { title, type: NOTE_TYPE, scope: NOTE_SCOPE, data });
      console.log(`[AISearch] ✅ ${isNew ? 'CREATE' : 'UPDATE'} complete → ${id}`);

      setEditing(null);
      // Refresh the visible list so the change shows immediately.
      if (hasSearched && query.trim()) {
        await runSearch();
      }
    } catch (e) {
      console.warn('[AISearch] save failed:', e);
      Alert.alert('Save failed', 'Could not save the entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: VectorSearchResult) => {
    Alert.alert('Delete entry', `Delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          console.log(`[AISearch] 🗑 DELETE form=${item.formId} title="${item.title}"`);
          try {
            await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', item.formId);
            console.log(`[AISearch] 🗑 form soft-deleted (active=0) → ${item.formId}`);
            await deleteFormVector(item.formId);
            setResults((prev) => prev.filter((r) => r.formId !== item.formId));
            console.log(`[AISearch] ✅ DELETE complete → ${item.formId}`);
          } catch (e) {
            console.warn('[AISearch] delete failed:', e);
            Alert.alert('Delete failed', 'Could not delete the entry.');
          }
        },
      },
    ]);
  };

  const longPressActions = (item: VectorSearchResult) => {
    Alert.alert(item.title, undefined, [
      { text: 'Open', onPress: () => handlePressResult(item) },
      { text: 'Edit', onPress: () => openEdit(item) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>AI Search</Text>
        <View style={styles.backButton} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="sparkles-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Search by meaning…"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          autoFocus
          editable={isReady}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
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
                The embedding model isn't loaded yet.
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
          {results.map((item) => {
            const sub = snippet(item.data);
            return (
              <Pressable
                key={item.formId}
                style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.6 }]}
                onPress={() => handlePressResult(item)}
                onLongPress={() => longPressActions(item)}>
                <View style={styles.resultContent}>
                  <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {sub ? (
                    <Text style={[styles.resultSnippet, { color: theme.textSecondary }]} numberOfLines={2}>
                      {sub}
                    </Text>
                  ) : null}
                  <View style={styles.resultMeta}>
                    {item.type ? (
                      <Text style={[styles.resultType, { color: theme.textSecondary, backgroundColor: theme.backgroundElement }]}>
                        {item.type}
                      </Text>
                    ) : null}
                    <Text style={[styles.resultScore, { color: theme.textSecondary }]}>
                      {Math.round(item.similarity * 100)}% match
                    </Text>
                  </View>
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
              </Pressable>
            );
          })}

          {hasSearched && results.length === 0 && (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              No matches found. Tap + to add an entry.
            </Text>
          )}
          {!hasSearched && (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Search your data by meaning, not just keywords.{'\n'}Tap + to add a new entry.
            </Text>
          )}
        </ScrollView>
      )}

      {isReady && (
        <Pressable
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 24 }, pressed && { opacity: 0.85 }]}
          onPress={openCreate}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </Pressable>
      )}

      <Modal
        visible={editing !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEditing(null)} hitSlop={8}>
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editing?.id === '' ? 'New Entry' : 'Edit Entry'}
              </Text>
              <Pressable onPress={handleSave} hitSlop={8} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <Text style={[styles.modalSave, { color: '#007AFF' }]}>Save</Text>
                )}
              </Pressable>
            </View>

            <TextInput
              style={[styles.modalTitleInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              value={editing?.title ?? ''}
              onChangeText={(t) => setEditing((e) => (e ? { ...e, title: t } : e))}
              autoFocus
            />
            <TextInput
              style={[styles.modalBodyInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              placeholder="Write something to remember…"
              placeholderTextColor={theme.textSecondary}
              value={editing?.body ?? ''}
              onChangeText={(t) => setEditing((e) => (e ? { ...e, body: t } : e))}
              multiline
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, height: 44 },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingHorizontal: 12, height: 40, borderRadius: 10 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  hint: { fontSize: 15, textAlign: 'center' },
  settingsBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  settingsBtnText: { fontSize: 15, fontWeight: '500' },
  scroll: { flex: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  resultContent: { flex: 1, gap: 3 },
  resultTitle: { fontSize: 16, fontWeight: '500' },
  resultSnippet: { fontSize: 13, lineHeight: 18 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  resultType: { fontSize: 11, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', textTransform: 'capitalize' },
  resultScore: { fontSize: 12 },
  empty: { textAlign: 'center', paddingTop: 80, fontSize: 15, paddingHorizontal: 32, lineHeight: 22 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalCancel: { fontSize: 16 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalSave: { fontSize: 16, fontWeight: '600' },
  modalTitleInput: { fontSize: 17, fontWeight: '500', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
  modalBodyInput: { fontSize: 15, lineHeight: 21, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, minHeight: 140 },
});
