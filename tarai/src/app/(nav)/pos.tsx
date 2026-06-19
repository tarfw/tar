import { useState, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { type FormRow } from '@/hooks/use-form';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

interface ProductSummary {
  variants: number;
  stock: number;
  minPrice: number;
  published: boolean;
}

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();

  const [products, setProducts] = useState<FormRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProductSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const rows = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'product' AND active = 1 ORDER BY time DESC"
    );
    console.log(`[POS] Loaded ${rows.length} products`);

    const sums: Record<string, ProductSummary> = {};
    for (const p of rows) {
      const variants = await db.getAllAsync<{ qty: number; value: number }>(
        "SELECT qty, value FROM matter WHERE form = ? AND type = 'variant' AND active = 1",
        p.id
      );
      const prices = variants.map(v => v.value).filter(v => v > 0);
      sums[p.id] = {
        variants: variants.length,
        stock: variants.reduce((s, v) => s + v.qty, 0),
        minPrice: prices.length ? Math.min(...prices) : 0,
        published: !!parseData(p.data).published,
      };
    }

    setProducts(rows);
    setSummaries(sums);
    setLoading(false);
  }, [db]);

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load();
      isMounted.current = true;
    }, [load])
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = `form_product_${Date.now()}`;
    const now = new Date().toISOString();
    console.log(`[POS] Create product: "${newName.trim()}" id=${id}`);
    await db.runAsync(
      "INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, 'product', ?, 'p', '{}', ?, 1)",
      id, newName.trim(), now
    );
    setNewName('');
    setShowAdd(false);
    router.push({ pathname: '/products', params: { id } });
  };

  const handleDelete = async (id: string) => {
    console.log(`[POS] Delete product: ${id}`);
    const variants = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM matter WHERE form = ? AND type = 'variant'", id
    );
    for (const v of variants) {
      await db.runAsync('DELETE FROM motion WHERE stream = ?', v.id);
    }
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', id);
    await db.runAsync('UPDATE matter SET active = 0 WHERE form = ?', id);
    await load();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Products</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={theme.text} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          {products.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>No products yet. Tap + to add one.</Text>
          ) : (
            products.map((p) => {
              const s = summaries[p.id];
              const subtitle = s
                ? [
                    `${s.variants} variant${s.variants !== 1 ? 's' : ''}`,
                    `${s.stock} in stock`,
                    s.minPrice ? `from ₹${s.minPrice.toLocaleString()}` : null,
                  ].filter(Boolean).join(' · ')
                : '';
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push({ pathname: '/products', params: { id: p.id } })}>
                  <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                    <Text style={[styles.thumbText, { color: theme.textSecondary }]}>{p.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowContent}>
                    <View style={styles.rowTitleLine}>
                      <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>{p.title}</Text>
                      {s?.published && (
                        <View style={[styles.badge, { backgroundColor: '#34C759' + '20' }]}>
                          <Text style={[styles.badgeText, { color: '#34C759' }]}>Live</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
                  </View>
                  <Pressable hitSlop={8} style={styles.deleteBtn} onPress={() => handleDelete(p.id)}>
                    <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Product Bottom Sheet */}
      <Modal visible={showAdd} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>New Product</Text>
              <Pressable onPress={handleCreate}>
                <Text style={{ color: newName.trim() ? '#5E6AD2' : theme.textSecondary, fontSize: 15, fontWeight: '600' }}>Create</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleCreate}
                placeholder="Product name"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                autoFocus
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  empty: { textAlign: 'center', paddingTop: 60, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  thumb: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  thumbText: { fontSize: 18, fontWeight: '600' },
  rowContent: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 6 },
  // Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  input: { fontSize: 16, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
});
