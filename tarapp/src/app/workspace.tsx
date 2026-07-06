import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';
import StorefrontTab from '@/components/StorefrontTab';

interface Product {
  id: string;
  title: string;
  qty: number;
  value: number;
  data: string;
}

export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { name, subdomain, scope } = useLocalSearchParams<{
    name: string; subdomain: string; scope: string;
  }>();

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

  const fetchProducts = useCallback(async () => {
    if (!scope) return;
    setLoadingProducts(true);
    try {
      const result = await tar.tool('read', { table: 'matter', type: 'product', active: 1, scope });
      setProducts(result.rows || []);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }, [scope]);

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
  }, [activeTab, fetchProducts]);

  const handleAddProduct = async () => {
    if (!productTitle.trim() || !productPrice.trim() || !scope) { setFormError('Name and price required'); return; }
    const val = parseFloat(productPrice);
    if (isNaN(val)) { setFormError('Price must be a number'); return; }
    setAddingProduct(true); setFormError('');
    try {
      await tar.tool('create', {
        table: 'matter', scope, type: 'product',
        title: productTitle.trim(), value: val,
        qty: productQty ? parseInt(productQty, 10) : 0,
        data: { category: productCategory.trim() || 'General' },
      });
      setProductTitle(''); setProductPrice(''); setProductQty(''); setProductCategory(''); setShowAddForm(false);
      await fetchProducts();
    } catch (e: any) { setFormError(e.message || 'Failed'); } finally { setAddingProduct(false); }
  };

  const sub = subdomain || scope?.replace('w:', '') || '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{name || sub}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}.tarai.space</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
        {(['storefront', 'products', 'info'] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, activeTab === t && { borderBottomColor: theme.primary }]}
            onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, { color: activeTab === t ? theme.primary : theme.textMuted },
              activeTab === t && { fontWeight: '600' }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'storefront' && scope && (
          <StorefrontTab storeId={scope} storeName={name || sub} subdomain={sub} products={products} />
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
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>No products</Text></View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
                {products.map((p) => {
                  let cat = 'General'; try { cat = JSON.parse(p.data)?.category || cat; } catch {}
                  return (
                    <View key={p.id} style={[styles.productCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pName, { color: theme.text }]}>{p.title}</Text>
                        <Text style={[styles.pCat, { color: theme.textMuted }]}>{cat}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.pPrice, { color: theme.primary }]}>{(p.value ?? 0).toFixed(0)}</Text>
                        <Text style={[styles.pQty, { color: theme.textMuted }]}>x{p.qty ?? 0}</Text>
                      </View>
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
              {[['Scope', scope], ['Domain', `https://${sub}.tarai.space`]].map(([label, val]) => (
                <View key={label as string}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{label}</Text>
                  <Text selectable style={[styles.infoVal, { color: theme.text }]}>{val}</Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
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
  emptyText: { fontSize: 14 },
  productCard: { flexDirection: 'row', marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  pName: { fontSize: 15, fontWeight: '500' },
  pCat: { fontSize: 12, marginTop: 2 },
  pPrice: { fontSize: 16, fontWeight: '700' },
  pQty: { fontSize: 12, marginTop: 2 },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  infoVal: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  divider: { height: 1, marginTop: 12 },
});
