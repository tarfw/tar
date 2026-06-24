import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useStorefront } from '@/hooks/use-storefront';
import { generateStorefrontLayout, type StorefrontProduct } from '@/lib/storefront-ai';
import { DEFAULT_LAYOUT, type StorefrontLayout, sectionSummary } from '@/lib/storefront-schema';

interface Props {
  storeId: string;
  storeName: string;
  subdomain?: string;
  products?: any[];
}

export default function StorefrontTab({ storeId, storeName, subdomain, products = [] }: Props) {
  const theme = useTheme();
  const { draft, published, loading, saveDraft, publish } = useStorefront(storeId);

  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productList: StorefrontProduct[] = products.map((p) => ({
    name: p.product_name ?? p.title ?? 'Item',
    price: p.value ?? null,
    variant: (() => { try { return JSON.parse(p.data || '{}').variant ?? null; } catch { return null; } })(),
  }));

  const handleGenerate = async () => {
    const text = instruction.trim();
    if (!text || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const layout = await generateStorefrontLayout(storeName, productList, text, draft);
      await saveDraft(layout);
      setInstruction('');
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!draft || publishing) return;
    setPublishing(true);
    try {
      await publish();
    } finally {
      setPublishing(false);
    }
  };

  const handleUseDefault = async () => {
    await saveDraft(DEFAULT_LAYOUT);
  };

  const slug = subdomain || storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const editorUrl = `${slug}.tarai.space/edit`;

  const handleOpenEditor = () => {
    Linking.openURL(`https://${editorUrl}`);
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} color={theme.textSecondary} />;
  }

  const isDirty = draft && JSON.stringify(draft) !== JSON.stringify(published);

  return (
    <View style={styles.container}>
      {/* Section preview list */}
      {draft ? (
        <ScrollView style={styles.sections} contentContainerStyle={{ paddingBottom: 8 }}>
          <View style={[styles.editorCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.editorCardHead}>
              <Ionicons name="desktop-outline" size={16} color={theme.text} />
              <Text style={[styles.editorCardTitle, { color: theme.text }]}>Desktop Live Editor</Text>
            </View>
            <Text selectable style={[styles.editorUrl, { color: '#5E6AD2' }]}>{editorUrl}</Text>
            <Text style={[styles.editorHint, { color: theme.textSecondary }]}>
              Open this on your computer to watch your edits live, full-screen.
            </Text>
            <Pressable style={styles.previewBtn} onPress={handleOpenEditor}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.previewBtnText}>Open Editor</Text>
            </Pressable>
          </View>
          {draft.sections.map((s, i) => (
            <View key={i} style={styles.sectionRow}>
              <View style={[styles.dot, { backgroundColor: draft.theme.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionType, { color: theme.text }]}>{s.type}</Text>
                <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>{sectionSummary(s)}</Text>
              </View>
            </View>
          ))}
          <View style={styles.themeRow}>
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>
              Theme · {draft.theme.font} · {draft.theme.primary} on {draft.theme.background}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Describe your storefront below — e.g. {'"modern dark store with a hero and product grid"'}.
          </Text>
          <Pressable style={styles.defaultBtn} onPress={handleUseDefault}>
            <Text style={styles.defaultBtnText}>Start with default template</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {/* Publish */}
      {draft ? (
        <Pressable
          style={({ pressed }) => [
            styles.publishBtn,
            { opacity: !isDirty || publishing || pressed ? 0.6 : 1 },
          ]}
          disabled={!isDirty || publishing}
          onPress={handlePublish}>
          {publishing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.publishText}>{isDirty ? 'Publish' : 'Published'}</Text>}
        </Pressable>
      ) : null}

      {/* AI chat bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="sparkles" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={instruction}
          onChangeText={setInstruction}
          placeholder={draft ? 'Make it dark, add testimonials…' : 'Describe your storefront…'}
          placeholderTextColor={theme.textSecondary}
          editable={!generating}
          onSubmitEditing={handleGenerate}
          returnKeyType="send"
        />
        {generating
          ? <ActivityIndicator size="small" color={theme.textSecondary} />
          : (
            <Pressable onPress={handleGenerate} disabled={!instruction.trim()}>
              <Ionicons name="arrow-up-circle" size={26} color={instruction.trim() ? '#5E6AD2' : theme.textSecondary} />
            </Pressable>
          )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  sections: { flex: 1 },
  sectionRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionType: { fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  sectionMeta: { fontSize: 12, marginTop: 2 },
  themeRow: { paddingHorizontal: 16, paddingTop: 8 },
  editorCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, gap: 8 },
  editorCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorCardTitle: { fontSize: 14, fontWeight: '600' },
  editorUrl: { fontSize: 14, fontWeight: '500' },
  editorHint: { fontSize: 12, lineHeight: 16 },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', marginTop: 4, paddingVertical: 12, borderRadius: 12 },
  previewBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  defaultBtn: { backgroundColor: '#5E6AD2', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  defaultBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: '#FF3B30', fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
  publishBtn: { backgroundColor: '#5E6AD2', marginHorizontal: 16, marginVertical: 8, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  publishText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
