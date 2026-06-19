import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById } from '@/hooks/use-form';
import { type MatterRow } from '@/hooks/use-matter';
import { suggestProductDetails, generateVariants, type ProductSuggestion } from '@/lib/ai';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

interface MotionRow {
  stream: string;
  seq: number;
  action: number;
  delta: number;
  data: string;
  time: string;
}

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const params = useLocalSearchParams<{ id: string }>();
  const { row: product, loading: productLoading } = useFormById(params.id);

  const [localTitle, setLocalTitle] = useState('');
  const [variants, setVariants] = useState<MatterRow[]>([]);
  const [motions, setMotions] = useState<MotionRow[]>([]);
  const [newVariant, setNewVariant] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showMetaSheet, setShowMetaSheet] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');

  // AI autofill
  const [showAi, setShowAi] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ProductSuggestion | null>(null);
  const [aiPickedVariants, setAiPickedVariants] = useState<Record<string, boolean>>({});
  const [aiApplyMeta, setAiApplyMeta] = useState(true);

  // AI variant generation
  const [showGen, setShowGen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResults, setGenResults] = useState<string[]>([]);
  const [genPicked, setGenPicked] = useState<Record<string, boolean>>({});

  const loadProduct = useCallback(async () => {
    if (!product) return;
    // Re-read the form row from the DB so chips reflect saved edits
    // (useFormById only loads once and never refreshes).
    const fresh = await db.getFirstAsync<{ data: string }>('SELECT data FROM form WHERE id = ?', product.id);
    const d = parseData(fresh?.data ?? product.data);
    setFormData(d);
    setBrand(d.brand || '');
    setCategory(d.category || '');
    const v = await db.getAllAsync<MatterRow>(
      "SELECT * FROM matter WHERE form = ? AND type = 'variant' AND active = 1 ORDER BY time ASC",
      product.id
    );
    console.log(`[PRODUCT] Variants for ${product.id}: ${v.length}`);
    setVariants(v);

    if (v.length > 0) {
      const ids = v.map(() => '?').join(', ');
      const m = await db.getAllAsync<MotionRow>(
        `SELECT * FROM motion WHERE stream IN (${ids}) ORDER BY time DESC LIMIT 20`,
        v.map(x => x.id)
      );
      setMotions(m);
    } else {
      setMotions([]);
    }
  }, [db, product]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (product) setLocalTitle(product.title);
    loadProduct();
  }, [product, loadProduct]);

  const getNextSeq = async (stream: string): Promise<number> => {
    const r = await db.getFirstAsync<{ max_seq: number }>(
      'SELECT COALESCE(MAX(seq), 0) + 1 as max_seq FROM motion WHERE stream = ?', stream
    );
    return r?.max_seq ?? 1;
  };

  const saveFormData = async (updates: Record<string, any>) => {
    if (!product) return;
    const merged = { ...formData, ...updates };
    console.log(`[PRODUCT] Save form data: ${product.id}`, merged);
    await db.runAsync('UPDATE form SET data = ? WHERE id = ?', JSON.stringify(merged), product.id);
    await loadProduct();
  };

  const handleSaveTitle = async () => {
    if (!product || !localTitle.trim()) return;
    console.log(`[PRODUCT] Save title: ${product.id} → "${localTitle.trim()}"`);
    await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), product.id);
  };

  const handleSaveMeta = async () => {
    await saveFormData({ brand: brand.trim(), category: category.trim() });
    setShowMetaSheet(false);
  };

  const runAutofill = useCallback(async () => {
    if (!product) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const suggestion = await suggestProductDetails(product.title);
      setAiResult(suggestion);
      // Pre-select all suggested variants that don't already exist.
      const existing = new Set(variants.map(v => (parseData(v.data).option || '').toLowerCase()));
      const picks: Record<string, boolean> = {};
      for (const opt of suggestion.variants) picks[opt] = !existing.has(opt.toLowerCase());
      setAiPickedVariants(picks);
      setAiApplyMeta(true);
    } catch (e: any) {
      console.log(`[PRODUCT] Autofill error: ${e?.message}`);
      setAiError(e?.message || 'Something went wrong');
    } finally {
      setAiLoading(false);
    }
  }, [product, variants]);

  const handleOpenAi = () => {
    setShowMenu(false);
    setShowAi(true);
    runAutofill();
  };

  const handleApplyAi = async () => {
    if (!product || !aiResult) return;
    console.log(`[PRODUCT] Apply autofill: ${product.id}`);

    if (aiApplyMeta) {
      const updates: Record<string, any> = {};
      if (aiResult.brand) updates.brand = aiResult.brand;
      if (aiResult.category) updates.category = aiResult.category;
      if (aiResult.description) updates.description = aiResult.description;
      if (Object.keys(updates).length) await saveFormData(updates);
    }

    const chosen = aiResult.variants.filter(opt => aiPickedVariants[opt]);
    if (chosen.length) await addVariants(chosen);

    setShowAi(false);
    setAiResult(null);
  };

  const addVariants = useCallback(async (options: string[]) => {
    if (!product || options.length === 0) return;
    const base = Date.now();
    for (let i = 0; i < options.length; i++) {
      await db.runAsync(
        "INSERT INTO matter (id, form, type, qty, value, data, time, active) VALUES (?, ?, 'variant', 0, 0, ?, ?, 1)",
        `var_${base}_${i}`, product.id, JSON.stringify({ option: options[i] }), new Date().toISOString()
      );
    }
    console.log(`[PRODUCT] Added ${options.length} variant(s)`);
    await loadProduct();
  }, [product, db, loadProduct]);

  const handleAddVariant = async () => {
    if (!newVariant.trim()) return;
    await addVariants([newVariant.trim()]);
    setNewVariant('');
  };

  const handleGenerateVariants = async () => {
    if (!product || !genPrompt.trim()) return;
    setGenLoading(true);
    setGenError(null);
    try {
      const existing = new Set(variants.map(v => (parseData(v.data).option || '').toLowerCase()));
      const results = await generateVariants(product.title, genPrompt.trim());
      const fresh = results.filter(r => !existing.has(r.toLowerCase()));
      setGenResults(fresh);
      const picks: Record<string, boolean> = {};
      for (const r of fresh) picks[r] = true;
      setGenPicked(picks);
    } catch (e: any) {
      console.log(`[PRODUCT] Generate variants error: ${e?.message}`);
      setGenError(e?.message || 'Something went wrong');
    } finally {
      setGenLoading(false);
    }
  };

  const handleApplyGenerated = async () => {
    const chosen = genResults.filter(r => genPicked[r]);
    if (chosen.length) await addVariants(chosen);
    setShowGen(false);
    setGenPrompt('');
    setGenResults([]);
  };

  const handleUpdateVariantOption = async (id: string, option: string) => {
    const v = variants.find(x => x.id === id);
    if (!v) return;
    const data = { ...parseData(v.data), option };
    setVariants(variants.map(x => x.id === id ? { ...x, data: JSON.stringify(data) } : x));
    await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', JSON.stringify(data), id);
  };

  const handleUpdateVariantPrice = async (id: string, priceText: string) => {
    const value = parseFloat(priceText) || 0;
    setVariants(variants.map(x => x.id === id ? { ...x, value } : x));
    await db.runAsync('UPDATE matter SET value = ? WHERE id = ?', value, id);
  };

  const handleAdjustStock = async (variant: MatterRow, delta: number) => {
    const newQty = Math.max(0, variant.qty + delta);
    if (newQty === variant.qty) return;
    const now = new Date().toISOString();
    console.log(`[PRODUCT] Adjust stock ${variant.id}: ${variant.qty} → ${newQty} (${delta > 0 ? '+' : ''}${delta})`);
    await db.runAsync('UPDATE matter SET qty = ? WHERE id = ?', newQty, variant.id);
    const seq = await getNextSeq(variant.id);
    await db.runAsync(
      'INSERT INTO motion (stream, seq, action, phase, delta, data, time) VALUES (?, ?, 101, 0, ?, ?, ?)',
      variant.id, seq, delta, JSON.stringify({ kind: delta > 0 ? 'restock' : 'sold', option: parseData(variant.data).option }), now
    );
    await loadProduct();
  };

  const handleDeleteVariant = async (id: string) => {
    console.log(`[PRODUCT] Delete variant: ${id}`);
    await db.runAsync('UPDATE matter SET active = 0 WHERE id = ?', id);
    await db.runAsync('DELETE FROM motion WHERE stream = ?', id);
    await loadProduct();
  };

  const handleTogglePublish = async () => {
    await saveFormData({ published: !formData.published });
    setShowMenu(false);
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    console.log(`[PRODUCT] Delete product: ${product.id}`);
    for (const v of variants) {
      await db.runAsync('DELETE FROM motion WHERE stream = ?', v.id);
    }
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', product.id);
    await db.runAsync('UPDATE matter SET active = 0 WHERE form = ?', product.id);
    setShowMenu(false);
  };

  const formatTime = (time: string) => {
    const d = new Date(time);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  if (productLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.text, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>Product not found</Text>
      </View>
    );
  }

  const data = formData;
  const published = !!data.published;
  const totalStock = variants.reduce((sum, v) => sum + v.qty, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}>
        {/* Title with thumbnail and menu */}
        <View style={styles.titleRow}>
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.thumbText, { color: theme.textSecondary }]}>{product.title.charAt(0).toUpperCase()}</Text>
          </View>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Product name"
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <Pressable onPress={handleOpenAi} style={styles.menuBtn}>
            <Ionicons name="sparkles" size={20} color="#5E6AD2" />
          </Pressable>
          <Pressable onPress={() => setShowMenu(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Metadata Chips */}
        <View style={styles.chipsRow}>
          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => setShowMetaSheet(true)}>
            <Ionicons name="pricetag-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: data.brand ? theme.text : theme.textSecondary }]}>{data.brand || 'Brand'}</Text>
          </Pressable>

          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => setShowMetaSheet(true)}>
            <Ionicons name="grid-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: data.category ? theme.text : theme.textSecondary }]}>{data.category || 'Category'}</Text>
          </Pressable>

          <Pressable
            style={[styles.chip, { backgroundColor: published ? '#34C759' + '20' : theme.backgroundElement }]}
            onPress={handleTogglePublish}>
            <Ionicons name={published ? 'cloud-done-outline' : 'cloud-outline'} size={14} color={published ? '#34C759' : theme.textSecondary} />
            <Text style={[styles.chipText, { color: published ? '#34C759' : theme.textSecondary }]}>{published ? 'Published' : 'Draft'}</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Variants */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Variants</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>{totalStock} in stock</Text>
            <Pressable style={styles.genBtn} onPress={() => setShowGen(true)}>
              <Ionicons name="sparkles" size={13} color="#5E6AD2" />
              <Text style={styles.genBtnText}>Generate</Text>
            </Pressable>
          </View>
        </View>

        {variants.map((v) => {
          const vd = parseData(v.data);
          return (
            <View key={v.id} style={styles.variantRow}>
              <View style={styles.variantInfo}>
                <TextInput
                  style={[styles.variantOption, { color: theme.text }]}
                  defaultValue={vd.option || ''}
                  onEndEditing={(e) => handleUpdateVariantOption(v.id, e.nativeEvent.text)}
                  placeholder="Option"
                  placeholderTextColor={theme.textSecondary}
                />
                <View style={styles.priceRow}>
                  <Text style={[styles.priceCurrency, { color: theme.textSecondary }]}>₹</Text>
                  <TextInput
                    style={[styles.priceInput, { color: theme.textSecondary }]}
                    defaultValue={v.value ? String(v.value) : ''}
                    onEndEditing={(e) => handleUpdateVariantPrice(v.id, e.nativeEvent.text)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.stepper}>
                <Pressable style={[styles.stepperBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => handleAdjustStock(v, -1)}>
                  <Ionicons name="remove" size={16} color={theme.text} />
                </Pressable>
                <Text style={[styles.stockQty, { color: theme.text }]}>{v.qty}</Text>
                <Pressable style={[styles.stepperBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => handleAdjustStock(v, 1)}>
                  <Ionicons name="add" size={16} color={theme.text} />
                </Pressable>
              </View>

              <Pressable style={styles.deleteVariantBtn} onPress={() => handleDeleteVariant(v.id)}>
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          );
        })}

        {/* Add Variant Input */}
        <View style={styles.variantRow}>
          <View style={[styles.thumbSmall, { borderColor: theme.textSecondary }]}>
            <Ionicons name="add" size={14} color={theme.textSecondary} />
          </View>
          <TextInput
            style={[styles.addVariantInput, { color: theme.text }]}
            value={newVariant}
            onChangeText={setNewVariant}
            onSubmitEditing={handleAddVariant}
            placeholder="Add variant (e.g. Size 9)"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
          />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 16 }]}>Stock activity</Text>

        {motions.length > 0 ? motions.map((m, i) => {
          const md = parseData(m.data);
          const isRestock = m.delta > 0;
          return (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: isRestock ? '#34C759' : '#FF9500' }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: theme.text }]}>
                  {isRestock ? 'Restock' : 'Sold'} {md.option ? `· ${md.option}` : ''}
                </Text>
                <Text style={[styles.timelineMeta, { color: theme.textSecondary }]}>
                  {formatTime(m.time)} · {m.delta > 0 ? '+' : ''}{m.delta}
                </Text>
              </View>
            </View>
          );
        }) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No stock activity yet</Text>
        )}
      </ScrollView>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />

            <View style={styles.menuOptions}>
              <Pressable style={styles.menuOption} onPress={handleTogglePublish}>
                <Ionicons name={published ? 'cloud-offline-outline' : 'cloud-upload-outline'} size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>{published ? 'Unpublish' : 'Publish to marketplace'}</Text>
              </Pressable>

              <Pressable style={styles.menuOption} onPress={() => setShowMenu(false)}>
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Duplicate</Text>
              </Pressable>

              <View style={[styles.menuSeparator, { backgroundColor: theme.backgroundElement }]} />

              <Pressable style={styles.menuOption} onPress={handleDeleteProduct}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>Delete product</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Metadata Edit Bottom Sheet */}
      <Modal visible={showMetaSheet} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMetaSheet(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Product details</Text>
              <Pressable style={styles.sheetDoneBtn} onPress={handleSaveMeta}>
                <Text style={styles.sheetDoneText}>Done</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}>
              <TextInput
                style={[styles.metaInput, { color: theme.text, borderColor: theme.backgroundElement }]}
                value={brand}
                onChangeText={setBrand}
                placeholder="Brand"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.metaInput, { color: theme.text, borderColor: theme.backgroundElement }]}
                value={category}
                onChangeText={setCategory}
                placeholder="Category"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI Autofill Bottom Sheet */}
      <Modal visible={showAi} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAi(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color="#5E6AD2" />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>AI Autofill</Text>
              </View>
              {aiResult && !aiLoading && (
                <Pressable style={styles.sheetDoneBtn} onPress={handleApplyAi}>
                  <Text style={styles.sheetDoneText}>Apply</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
              {aiLoading && (
                <View style={styles.aiCentered}>
                  <ActivityIndicator color="#5E6AD2" />
                  <Text style={[styles.aiHint, { color: theme.textSecondary }]}>Analysing “{product.title}”…</Text>
                </View>
              )}

              {aiError && !aiLoading && (
                <View style={styles.aiCentered}>
                  <Ionicons name="cloud-offline-outline" size={28} color={theme.textSecondary} />
                  <Text style={[styles.aiHint, { color: theme.textSecondary }]}>{aiError}</Text>
                  <Pressable style={[styles.aiRetryBtn, { backgroundColor: theme.backgroundElement }]} onPress={runAutofill}>
                    <Text style={[styles.aiRetryText, { color: theme.text }]}>Try again</Text>
                  </Pressable>
                </View>
              )}

              {aiResult && !aiLoading && (
                <View>
                  {/* Meta suggestion */}
                  <Pressable style={styles.aiMetaCard} onPress={() => setAiApplyMeta(!aiApplyMeta)}>
                    <View style={[styles.aiCheck, { borderColor: aiApplyMeta ? '#5E6AD2' : theme.textSecondary, backgroundColor: aiApplyMeta ? '#5E6AD2' : 'transparent' }]}>
                      {aiApplyMeta && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      {aiResult.brand ? <Text style={[styles.aiMetaLine, { color: theme.text }]}>Brand · {aiResult.brand}</Text> : null}
                      {aiResult.category ? <Text style={[styles.aiMetaLine, { color: theme.text }]}>Category · {aiResult.category}</Text> : null}
                      {aiResult.description ? <Text style={[styles.aiMetaDesc, { color: theme.textSecondary }]}>{aiResult.description}</Text> : null}
                      {!aiResult.brand && !aiResult.category && !aiResult.description ? <Text style={[styles.aiMetaDesc, { color: theme.textSecondary }]}>No details suggested</Text> : null}
                    </View>
                  </Pressable>

                  {/* Variant suggestions */}
                  {aiResult.variants.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: theme.textSecondary, paddingTop: 16, paddingBottom: 8 }]}>Suggested variants</Text>
                      <View style={styles.aiChipWrap}>
                        {aiResult.variants.map((opt) => {
                          const picked = !!aiPickedVariants[opt];
                          return (
                            <Pressable
                              key={opt}
                              style={[styles.aiChip, { backgroundColor: picked ? '#5E6AD2' : theme.backgroundElement }]}
                              onPress={() => setAiPickedVariants({ ...aiPickedVariants, [opt]: !picked })}>
                              {picked && <Ionicons name="checkmark" size={13} color="#fff" />}
                              <Text style={[styles.aiChipText, { color: picked ? '#fff' : theme.text }]}>{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}

                  <Text style={[styles.aiFootnote, { color: theme.textSecondary }]}>Review and tap Apply. Nothing is saved until you do.</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Generate Variants Bottom Sheet */}
      <Modal visible={showGen} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowGen(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color="#5E6AD2" />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Generate variants</Text>
              </View>
              {genResults.length > 0 && (
                <Pressable style={styles.sheetDoneBtn} onPress={handleApplyGenerated}>
                  <Text style={styles.sheetDoneText}>Add</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
              <View style={styles.genInputRow}>
                <TextInput
                  style={[styles.metaInput, { flex: 1, color: theme.text, borderColor: theme.backgroundElement }]}
                  value={genPrompt}
                  onChangeText={setGenPrompt}
                  onSubmitEditing={handleGenerateVariants}
                  placeholder="Describe variants, e.g. sizes 6-11"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="go"
                  autoFocus
                />
                <Pressable
                  style={[styles.genGoBtn, { backgroundColor: genPrompt.trim() ? '#5E6AD2' : theme.backgroundElement }]}
                  onPress={handleGenerateVariants}
                  disabled={!genPrompt.trim() || genLoading}>
                  {genLoading
                    ? <ActivityIndicator size="small" color={genPrompt.trim() ? '#fff' : theme.textSecondary} />
                    : <Ionicons name="arrow-forward" size={18} color={genPrompt.trim() ? '#fff' : theme.textSecondary} />}
                </Pressable>
              </View>

              {genError && !genLoading && (
                <Text style={[styles.aiHint, { color: theme.textSecondary, paddingVertical: 16 }]}>{genError}</Text>
              )}

              {genResults.length > 0 && !genLoading && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary, paddingTop: 16, paddingBottom: 8 }]}>
                    {genResults.filter(r => genPicked[r]).length} of {genResults.length} selected
                  </Text>
                  <View style={styles.aiChipWrap}>
                    {genResults.map((opt) => {
                      const picked = !!genPicked[opt];
                      return (
                        <Pressable
                          key={opt}
                          style={[styles.aiChip, { backgroundColor: picked ? '#5E6AD2' : theme.backgroundElement }]}
                          onPress={() => setGenPicked({ ...genPicked, [opt]: !picked })}>
                          {picked && <Ionicons name="checkmark" size={13} color="#fff" />}
                          <Text style={[styles.aiChipText, { color: picked ? '#fff' : theme.text }]}>{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  thumb: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  thumbText: { fontSize: 16, fontWeight: '600' },
  titleInput: { flex: 1, fontSize: 24, fontWeight: '600', paddingVertical: 0, lineHeight: 30 },
  menuBtn: { padding: 8 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '500' },
  sectionMeta: { fontSize: 13, fontWeight: '500' },
  variantRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  variantInfo: { flex: 1 },
  variantOption: { fontSize: 16, fontWeight: '500', paddingVertical: 0 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  priceCurrency: { fontSize: 13 },
  priceInput: { fontSize: 13, paddingVertical: 0, minWidth: 60 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stockQty: { fontSize: 15, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  deleteVariantBtn: { padding: 4 },
  thumbSmall: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  addVariantInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  // Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetDoneBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  sheetDoneText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  metaInput: { fontSize: 16, borderWidth: 1, borderRadius: 10, padding: 12 },
  menuOptions: { paddingHorizontal: 20, paddingVertical: 16 },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  menuOptionText: { fontSize: 16, fontWeight: '500' },
  menuSeparator: { height: 1, marginVertical: 8 },
  // AI Autofill
  sheetScroll: { paddingHorizontal: 20 },
  aiCentered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  aiHint: { fontSize: 14, textAlign: 'center' },
  aiRetryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  aiRetryText: { fontSize: 14, fontWeight: '600' },
  aiMetaCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  aiCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  aiMetaLine: { fontSize: 15, fontWeight: '500' },
  aiMetaDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  aiChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  aiChipText: { fontSize: 13, fontWeight: '500' },
  aiFootnote: { fontSize: 12, textAlign: 'center', paddingTop: 20 },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  genBtnText: { fontSize: 13, fontWeight: '600', color: '#5E6AD2' },
  genInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  genGoBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
