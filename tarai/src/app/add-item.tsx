import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, FlatList, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { suggestProductDetails } from '@/lib/ai';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

type Step = 'search' | 'variants';

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ storeId: string }>();

  const [step, setStep] = useState<Step>('search');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Create local product state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newOptions, setNewOptions] = useState('');
  const [newModifiers, setNewModifiers] = useState('');

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Variants state
  const [variants, setVariants] = useState<{ option: string; qty: string; price: string; location: string; picked: boolean }[]>([]);
  const [adding, setAdding] = useState(false);

  // Load products (all when empty, filtered when searching)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        let results: any[];
        if (searchQuery.trim()) {
          results = await db.getAllAsync<any>(
            `SELECT * FROM form WHERE type = 'product' AND active = 1
             AND (title LIKE ? OR data LIKE ?)
             ORDER BY time DESC LIMIT 50`,
            `%${searchQuery}%`, `%${searchQuery}%`
          );
        } else {
          results = await db.getAllAsync<any>(
            `SELECT * FROM form WHERE type = 'product' AND active = 1
             ORDER BY time DESC LIMIT 50`
          );
        }
        if (!cancelled) setGlobalProducts(results);
      } catch (e) {
        console.warn('[AddItem] search failed:', e);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, db]);

  const handleSelectGlobalProduct = (product: any) => {
    setSelectedProduct(product);
    // Parse existing variants from product data
    const data = parseData(product.data);
    const existingVariants = data.variants || [];
    setVariants(existingVariants.map((v: string) => ({
      option: v,
      qty: '',
      price: '',
      location: '',
      picked: true,
    })));
    setStep('variants');
  };

  const handleCreateLocalProduct = () => {
    router.push({ pathname: '/product', params: { mode: 'create', storeId: params.storeId } });
  };

  const handleAddVariant = () => {
    setVariants([...variants, { option: '', qty: '', price: '', location: '', picked: true }]);
  };

  const handleAiGenerate = async () => {
    if (!newName.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const suggestion = await suggestProductDetails(newName.trim());
      if (suggestion.category) setNewCategory(suggestion.category);
      if (suggestion.description) setNewDescription(suggestion.description);
      if (suggestion.variants.length > 0) {
        setNewOptions(suggestion.variants.join(', '));
      }
    } catch (e: any) {
      console.warn('[AddItem] AI generate failed:', e);
      setAiError(e?.message || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleUpdateVariant = (index: number, field: string, value: string) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const handleToggleVariant = (index: number) => {
    const updated = [...variants];
    updated[index].picked = !updated[index].picked;
    setVariants(updated);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleAddItems = async () => {
    if (!selectedProduct || !params.storeId) return;
    const picked = variants.filter(v => v.picked && v.option.trim());
    if (picked.length === 0) return;

    setAdding(true);
    try {
      const now = new Date().toISOString();
      for (const variant of picked) {
        const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const qty = parseInt(variant.qty) || 0;
        const price = parseFloat(variant.price) || 0;

        // Create matter row (item)
        await db.runAsync(
          `INSERT INTO matter (id, form, type, qty, value, data, time, active)
           VALUES (?, ?, 'stock', ?, ?, ?, ?, 1)`,
          itemId,
          selectedProduct.id,
          qty,
          price,
          JSON.stringify({ variant: variant.option, location: variant.location }),
          now
        );

        // Create graph connection (item → store)
        await db.runAsync(
          'INSERT OR IGNORE INTO graph (src, tgt, type, time) VALUES (?, ?, ?, ?)',
          itemId, params.storeId, 'belongs_to', now
        );

        // Create graph connection (item → product)
        await db.runAsync(
          'INSERT OR IGNORE INTO graph (src, tgt, type, time) VALUES (?, ?, ?, ?)',
          itemId, selectedProduct.id, 'has_stock', now
        );

        // Create initial motion (TRANS_IN)
        if (qty > 0) {
          const seq = (await db.getFirstAsync<{ max_seq: number }>(
            'SELECT COALESCE(MAX(seq), 0) + 1 as max_seq FROM motion WHERE stream = ?', itemId
          ))?.max_seq ?? 1;
          await db.runAsync(
            'INSERT INTO motion (stream, seq, action, delta, data, time) VALUES (?, ?, 406, ?, ?, ?)',
            itemId, seq, qty, JSON.stringify({ variant: variant.option, initial: true }), now
          );
        }
      }

      router.back();
    } catch (e) {
      console.warn('[AddItem] failed:', e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Search Bar - only on search step */}
      {step === 'search' && (
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, marginTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {/* Header for create/variants steps */}
      {step !== 'search' && (
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.backgroundElement }]}>
          <Pressable onPress={() => setStep(step === 'variants' ? 'search' : 'search')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {step === 'create' ? 'Create Product' : 'Add Items'}
          </Text>
          {step === 'variants' ? (
            <Pressable style={styles.saveBtn} onPress={handleAddItems} disabled={adding}>
              {adding ? (
                <ActivityIndicator size="small" color="#5E6AD2" />
              ) : (
                <Text style={{ color: '#5E6AD2', fontSize: 16, fontWeight: '600' }}>Add</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.saveBtn} />
          )}
        </View>
      )}

      {/* Step: Search */}
      {step === 'search' && (
        <View style={styles.content}>
          <FlatList
            data={globalProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={() => (
              <>
                {searching && (
                  <View style={styles.centered}>
                    <ActivityIndicator color={theme.textSecondary} />
                  </View>
                )}
                {!searching && globalProducts.length === 0 && searchQuery.length > 0 && (
                  <View style={styles.centered}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No products found</Text>
                  </View>
                )}
                {!searching && globalProducts.length > 0 && (
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                    {searchQuery ? 'Results' : 'All Products'}
                  </Text>
                )}
              </>
            )}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.productRow, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/product', params: { id: item.id, mode: 'edit', storeId: params.storeId } })}>
                <View style={[styles.productThumb, { backgroundColor: '#5E6AD220' }]}>
                  <Text style={[styles.productThumbText, { color: '#5E6AD2' }]}>{item.title.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={[styles.productName, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.productId, { color: theme.textSecondary }]} numberOfLines={1}>{item.id}</Text>
                </View>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />}
          />

          {/* Bottom Bar */}
          <View style={[styles.bottomBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.bottomBarRow}>
              <Pressable
                style={({ pressed }) => [styles.chip, { backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/product', params: { mode: 'create', storeId: params.storeId } })}>
                <Ionicons name="add" size={16} color={theme.text} />
                <Text style={[styles.chipText, { color: theme.text }]}>product</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                style={({ pressed }) => [styles.searchIconBtn, pressed && { opacity: 0.7 }]}
                onPress={() => searchRef.current?.focus()}>
                <Ionicons name="search" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Step: Select Variants & Set Stock */}
      {step === 'variants' && selectedProduct && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
          <View style={[styles.selectedProduct, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="cube-outline" size={20} color="#5E6AD2" />
            <Text style={[styles.selectedProductName, { color: theme.text }]}>{selectedProduct.title}</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 16 }]}>
            Select variants & set stock
          </Text>

          {variants.map((variant, index) => (
            <View key={index} style={[styles.variantCard, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                style={[styles.checkbox, variant.picked && { backgroundColor: '#5E6AD2', borderColor: '#5E6AD2' }]}
                onPress={() => handleToggleVariant(index)}>
                {variant.picked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </Pressable>

              <View style={styles.variantFields}>
                <TextInput
                  style={[styles.variantInput, { color: theme.text }]}
                  value={variant.option}
                  onChangeText={(v) => handleUpdateVariant(index, 'option', v)}
                  placeholder="Variant (e.g. 250ml)"
                  placeholderTextColor={theme.textSecondary}
                />
                <View style={styles.variantRow}>
                  <View style={styles.variantField}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontSize: 11 }]}>Stock</Text>
                    <TextInput
                      style={[styles.variantFieldInput, { color: theme.text }]}
                      value={variant.qty}
                      onChangeText={(v) => handleUpdateVariant(index, 'qty', v)}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.variantField}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontSize: 11 }]}>Price ₹</Text>
                    <TextInput
                      style={[styles.variantFieldInput, { color: theme.text }]}
                      value={variant.price}
                      onChangeText={(v) => handleUpdateVariant(index, 'price', v)}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.variantField, { flex: 1.5 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, fontSize: 11 }]}>Location</Text>
                    <TextInput
                      style={[styles.variantFieldInput, { color: theme.text }]}
                      value={variant.location}
                      onChangeText={(v) => handleUpdateVariant(index, 'location', v)}
                      placeholder="e.g. Fridge A1"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>
              </View>

              <Pressable style={styles.removeBtn} onPress={() => handleRemoveVariant(index)}>
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          ))}

          <Pressable
            style={({ pressed }) => [styles.addVariantBtn, { borderColor: theme.textSecondary }, pressed && { opacity: 0.7 }]}
            onPress={handleAddVariant}>
            <Ionicons name="add" size={18} color={theme.textSecondary} />
            <Text style={[styles.addVariantBtnText, { color: theme.textSecondary }]}>Add Variant</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { paddingVertical: 8, minWidth: 50, alignItems: 'flex-end' },
  backBtn: { padding: 4 },
  content: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 44, borderRadius: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  scrollView: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '500', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  productThumb: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  productThumbText: { fontSize: 16, fontWeight: '600' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '500' },
  productId: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginVertical: 4 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  bottomBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 16 },
  bottomBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, gap: 6 },
  chipText: { fontSize: 15, fontWeight: '600' },
  searchIconBtn: { padding: 10 },
  fieldGroup: { paddingHorizontal: 16, paddingTop: 12 },
  nameInput: { fontSize: 24, fontWeight: '600', paddingVertical: 4 },
  fieldInput: { fontSize: 16, paddingVertical: 8 },
  aiGenerateText: { fontSize: 15, fontWeight: '500' },
  aiLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiLoadingText: { fontSize: 14 },
  aiError: { fontSize: 12, marginTop: 4 },
  continueBtn: { marginHorizontal: 16, marginTop: 32, backgroundColor: '#5E6AD2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  continueBtnText: { fontSize: 16, fontWeight: '600' },
  selectedProduct: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, gap: 10 },
  selectedProductName: { fontSize: 15, fontWeight: '500', flex: 1 },
  variantCard: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  variantFields: { flex: 1, gap: 8 },
  variantInput: { fontSize: 15, fontWeight: '500', paddingVertical: 0 },
  variantRow: { flexDirection: 'row', gap: 8 },
  variantField: { flex: 1 },
  variantFieldInput: { fontSize: 14, paddingVertical: 4 },
  removeBtn: { padding: 4 },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', gap: 6 },
  addVariantBtnText: { fontSize: 14, fontWeight: '500' },
});
