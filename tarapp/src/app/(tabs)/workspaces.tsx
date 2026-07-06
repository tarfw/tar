import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';
import StorefrontTab from '@/components/StorefrontTab';

interface Workspace { scope: string; subdomain: string; role: string; name?: string; }
interface Product { id: string; title: string; qty: number; value: number; data: string; }

export default function WorkspacesTabScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'storefront' | 'products' | 'info'>('storefront');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productQty, setProductQty] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tar.listWorkspaces();
      const rows = data.workspaces || [];
      setWorkspaces(rows);
      if (rows.length > 0 && !selected) setSelected(rows[0]);
    } catch (e) {
      console.warn('[Workspaces] Failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const fetchProducts = useCallback(async () => {
    if (!selected?.scope) return;
    setLoadingProducts(true);
    try {
      const result = await tar.tool('read', { table: 'matter', type: 'product', active: 1, scope: selected.scope });
      setProducts(result.rows || []);
    } catch (e) {
      console.warn('[Products] Failed:', e);
    } finally {
      setLoadingProducts(false);
    }
  }, [selected?.scope]);

  useEffect(() => { if (activeTab === 'products') fetchProducts(); }, [activeTab, fetchProducts]);

  const handleAddProduct = async () => {
    if (!productTitle.trim() || !productPrice.trim() || !selected?.scope) { setFormError('Name and price required'); return; }
    const val = parseFloat(productPrice);
    if (isNaN(val)) { setFormError('Invalid price'); return; }
    setAddingProduct(true); setFormError('');
    try {
      await tar.tool('create', {
        table: 'matter', scope: selected.scope, type: 'product',
        title: productTitle.trim(), value: val,
        qty: productQty ? parseInt(productQty, 10) : 0,
        data: { category: productCategory.trim() || 'General' },
      });
      setProductTitle(''); setProductPrice(''); setProductQty(''); setProductCategory(''); setShowAddForm(false);
      await fetchProducts();
    } catch (e: any) { setFormError(e.message || 'Failed'); } finally { setAddingProduct(false); }
  };

  const sub = selected?.subdomain || selected?.scope?.replace('w:', '') || '';

  // ── Loading ──────────────────────────────────────────
  if (loading) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.primary} /></View>;
  }

  // ── No workspaces ────────────────────────────────────
  if (workspaces.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, gap: 12 }]}>
        <Ionicons name="briefcase-outline" size={40} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted }}>No workspaces</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Picker header */}
      <Pressable style={[styles.pickerHeader, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]} onPress={() => setShowPicker(true)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pickerTitle, { color: theme.text }]} numberOfLines={1}>
            {selected?.name || sub}
          </Text>
          <Text style={[styles.pickerSub, { color: theme.textMuted }]}>{sub}.tarai.space</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
      </Pressable>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['storefront', 'products', 'info'] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, activeTab === t && { borderBottomColor: theme.primary }]}
            onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, { color: activeTab === t ? theme.primary : theme.textMuted },
              activeTab === t && { fontWeight: '600' }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'storefront' && selected && (
          <StorefrontTab storeId={selected.scope} storeName={selected.name || sub} subdomain={sub} products={products} />
        )}

        {activeTab === 'products' && (
          <View style={{ flex: 1 }}>
            <View style={styles.productsHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Products</Text>
              <Pressable style={[styles.addBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowAddForm(!showAddForm)}>
                <Ionicons name={showAddForm ? 'close' : 'add'} size={16} color="#fff" />
                <Text style={styles.addBtnText}>{showAddForm ? 'Cancel' : 'Add'}</Text>
              </Pressable>
            </View>
            {showAddForm && (
              <View style={[styles.form, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={productTitle} onChangeText={setProductTitle} placeholder="Name" placeholderTextColor={theme.textMuted} />
                <View style={styles.formRow}>
                  <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={productPrice} onChangeText={setProductPrice} placeholder="Price" placeholderTextColor={theme.textMuted} keyboardType="numeric" />
                  <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={productQty} onChangeText={setProductQty} placeholder="Qty" placeholderTextColor={theme.textMuted} keyboardType="numeric" />
                </View>
                <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                  value={productCategory} onChangeText={setProductCategory} placeholder="Category" placeholderTextColor={theme.textMuted} />
                {formError ? <Text style={styles.error}>{formError}</Text> : null}
                <Pressable style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleAddProduct} disabled={addingProduct}>
                  {addingProduct ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </Pressable>
              </View>
            )}
            {loadingProducts ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={theme.textSecondary} />
            ) : products.length === 0 ? (
              <View style={styles.empty}><Ionicons name="cube-outline" size={40} color={theme.textMuted} />
                <Text style={{ color: theme.textMuted }}>No products</Text></View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {products.map((p) => {
                  let cat = 'General'; try { cat = JSON.parse(p.data)?.category || cat; } catch {}
                  return (
                    <View key={p.id} style={[styles.productCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}><Text style={[styles.pName, { color: theme.text }]}>{p.title}</Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>{cat}</Text></View>
                      <View style={{ alignItems: 'flex-end' }}><Text style={[styles.pPrice, { color: theme.primary }]}>{(p.value ?? 0).toFixed(0)}</Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>x{p.qty ?? 0}</Text></View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {activeTab === 'info' && (
          <ScrollView style={{ padding: 16 }}>
            <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {[['Scope', selected?.scope], ['Domain', `https://${sub}.tarai.space`]].map(([l, v]) => (
                <View key={l as string}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{l}</Text>
                  <Text selectable style={[styles.infoVal, { color: theme.text }]}>{v}</Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <View style={[styles.handle, { backgroundColor: theme.textMuted }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Workspaces</Text>
            <FlatList
              data={workspaces}
              keyExtractor={(i) => i.scope}
              renderItem={({ item }) => {
                const s = item.subdomain || item.scope.replace('w:', '');
                const active = item.scope === selected?.scope;
                return (
                  <Pressable style={[styles.sheetItem, { borderBottomColor: theme.border }, active && { backgroundColor: theme.primary + '10' }]}
                    onPress={() => { setSelected(item); setShowPicker(false); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '500', color: active ? theme.primary : theme.text }}>{item.name || s}</Text>
                      <Text style={{ fontSize: 13, color: theme.textMuted }}>{s}.tarai.space</Text>
                    </View>
                    {active && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <Pressable style={[styles.sheetItem, { borderBottomColor: theme.border }]}
                  onPress={() => { setShowPicker(false); }}>
                  <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                  <Text style={{ fontSize: 16, fontWeight: '500', color: theme.primary, marginLeft: 10 }}>New Workspace</Text>
                </Pressable>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  pickerTitle: { fontSize: 20, fontWeight: '700' },
  pickerSub: { fontSize: 12, marginTop: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14 },
  productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  form: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1, gap: 10 },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, fontSize: 14 },
  saveBtn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  error: { color: '#f44336', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  productCard: { flexDirection: 'row', marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  pName: { fontSize: 15, fontWeight: '500' },
  pPrice: { fontSize: 16, fontWeight: '700' },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  infoVal: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  divider: { height: 1, marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16, opacity: 0.3 },
  sheetTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
});
