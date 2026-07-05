import { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { create } from '@/lib/tools';
import StorefrontTab from '@/components/StorefrontTab';

interface Workspace {
  id: string;
  title: string;
  scope: string;
  code: string;
  data: string;
}

interface Product {
  id: string;
  title: string;
  qty: number;
  value: number;
  data: string;
}

export default function WorkspacesTabScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const db = useDb();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Selected workspace state (for detail view)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  // Detail view tabs
  const [activeDetailTab, setActiveDetailTab] = useState<'storefront' | 'products' | 'info'>('storefront');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // New product form state
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productQty, setProductQty] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const rows = await db.getAllAsync<Workspace>(
        "SELECT id, title, scope, code, data FROM form WHERE type = 'workspace' AND active = 1 ORDER BY time DESC"
      );
      setWorkspaces(rows);

      setSelectedWorkspace((prev) => {
        if (rows.length === 1) {
          return rows[0];
        }
        if (rows.length > 1 && prev) {
          return rows.find(w => w.id === prev.id) || null;
        }
        return null;
      });
    } catch (e) {
      console.warn('[WorkspacesTab] Failed to fetch workspaces:', e);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [db]);

  const fetchProducts = useCallback(async () => {
    if (!selectedWorkspace?.scope) return;
    setLoadingProducts(true);
    try {
      const rows = await db.getAllAsync<Product>(
        "SELECT id, title, qty, value, data FROM matter WHERE scope = ? AND type = 'product' AND active = 1 ORDER BY time DESC",
        selectedWorkspace.scope
      );
      setProducts(rows);
    } catch (e) {
      console.warn('[WorkspacesTab] Failed to fetch products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }, [db, selectedWorkspace?.scope]);

  useFocusEffect(
    useCallback(() => {
      fetchWorkspaces();
    }, [fetchWorkspaces])
  );

  useEffect(() => {
    if (selectedWorkspace && activeDetailTab === 'products') {
      fetchProducts();
    }
  }, [selectedWorkspace?.scope, activeDetailTab, fetchProducts]);

  const handleAddProduct = async () => {
    if (!productTitle.trim() || !productPrice.trim() || !selectedWorkspace) {
      setFormError('Title and price are required');
      return;
    }
    const val = parseFloat(productPrice);
    if (isNaN(val)) {
      setFormError('Price must be a number');
      return;
    }

    setAddingProduct(true);
    setFormError('');
    try {
      await create({
        table: 'matter',
        scope: selectedWorkspace.scope,
        type: 'product',
        title: productTitle.trim(),
        value: val,
        qty: productQty ? parseInt(productQty, 10) : 0,
        data: {
          category: productCategory.trim() || 'General',
        },
      });

      setProductTitle('');
      setProductPrice('');
      setProductQty('');
      setProductCategory('');
      setShowAddForm(false);

      await fetchProducts();
    } catch (e: any) {
      setFormError(e.message || 'Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

  const getSubdomain = (w: Workspace) => {
    try {
      const parsed = JSON.parse(w.data);
      return parsed.subdomain || w.code;
    } catch {
      return w.code;
    }
  };

  const getVertical = (w: Workspace) => {
    try {
      const parsed = JSON.parse(w.data);
      return parsed.vertical || 'general';
    } catch {
      return 'general';
    }
  };

  if (loadingWorkspaces) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Case 1: No workspaces created yet
  if (workspaces.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="briefcase-outline" size={64} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text, marginTop: 16 }]}>No workspaces yet</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textMuted, textAlign: 'center', marginVertical: 8 }]}>
          Create a workspace to manage your storefront, inventory, and templates.
        </Text>
        <Pressable
          style={[styles.createBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/onboarding')}>
          <Text style={styles.createBtnText}>Create Workspace</Text>
        </Pressable>
      </View>
    );
  }

  // Case 2: User has selected a workspace (or auto-selected because they have only one)
  if (selectedWorkspace) {
    const subdomain = getSubdomain(selectedWorkspace);
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Workspace Detail Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
          {workspaces.length > 1 && (
            <Pressable onPress={() => setSelectedWorkspace(null)} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          )}
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {selectedWorkspace.title}
            </Text>
            <Text style={[styles.subdomain, { color: theme.textMuted }]}>
              {subdomain}.tarai.space
            </Text>
          </View>
        </View>

        {/* Tabs selector */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {(['storefront', 'products', 'info'] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tabButton,
                activeDetailTab === tab && [styles.tabButtonActive, { borderBottomColor: theme.primary }],
              ]}
              onPress={() => setActiveDetailTab(tab)}>
              <Text
                style={[
                  styles.tabText,
                  { color: activeDetailTab === tab ? theme.primary : theme.textMuted },
                  activeDetailTab === tab && styles.tabTextActive,
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.content}>
          {activeDetailTab === 'storefront' && (
            <StorefrontTab
              storeId={selectedWorkspace.id}
              storeName={selectedWorkspace.title}
              subdomain={subdomain}
              products={products}
            />
          )}

          {activeDetailTab === 'products' && (
            <View style={{ flex: 1 }}>
              <View style={styles.productsHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Products Inventory</Text>
                <Pressable
                  style={[styles.addButton, { backgroundColor: theme.primary }]}
                  onPress={() => setShowAddForm(!showAddForm)}>
                  <Ionicons name={showAddForm ? 'close' : 'add'} size={18} color="#fff" />
                  <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : 'Add Product'}</Text>
                </Pressable>
              </View>

              {showAddForm && (
                <View style={[styles.form, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <Text style={[styles.formTitle, { color: theme.text }]}>Add New Product</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={productTitle}
                    onChangeText={setProductTitle}
                    placeholder="Product Name"
                    placeholderTextColor={theme.textMuted}
                  />
                  <View style={styles.formRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      value={productPrice}
                      onChangeText={setProductPrice}
                      placeholder="Price ($)"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                      value={productQty}
                      onChangeText={setProductQty}
                      placeholder="Quantity"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                    value={productCategory}
                    onChangeText={setProductCategory}
                    placeholder="Category (e.g., Food, Service)"
                    placeholderTextColor={theme.textMuted}
                  />
                  {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                  <Pressable
                    style={[styles.submitButton, { backgroundColor: theme.primary }]}
                    onPress={handleAddProduct}
                    disabled={addingProduct}>
                    {addingProduct ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Save Product</Text>
                    )}
                  </Pressable>
                </View>
              )}

              {loadingProducts ? (
                <ActivityIndicator style={{ marginTop: 24 }} color={theme.textSecondary} />
              ) : products.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={48} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>No products in inventory yet</Text>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
                  {products.map((p) => {
                    let category = 'General';
                    try {
                      const parsed = JSON.parse(p.data);
                      if (parsed.category) category = parsed.category;
                    } catch {}
                    return (
                      <View
                        key={p.id}
                        style={[styles.productCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.productTitle, { color: theme.text }]}>{p.title}</Text>
                          <Text style={[styles.productCategory, { color: theme.textMuted }]}>{category}</Text>
                        </View>
                        <View style={styles.productValues}>
                          <Text style={[styles.productPrice, { color: theme.primary }]}>
                            ${(p.value ?? 0).toFixed(2)}
                          </Text>
                          <Text style={[styles.productQty, { color: theme.textMuted }]}>
                            Qty: {p.qty ?? 0}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {activeDetailTab === 'info' && (
            <ScrollView style={styles.infoContainer} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
              <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text style={[styles.infoCardTitle, { color: theme.text }]}>Workspace Information</Text>
                
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Scope ID</Text>
                  <Text selectable style={[styles.infoVal, { color: theme.text }]}>{selectedWorkspace.scope}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Form ID</Text>
                  <Text selectable style={[styles.infoVal, { color: theme.text }]}>{selectedWorkspace.id}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Domain</Text>
                  <Text selectable style={[styles.infoVal, { color: theme.text }]}>
                    https://{subdomain}.tarai.space
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // Case 3: Multiple workspaces, show list selector
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>My Workspaces</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
        {workspaces.map((w) => {
          const subdomain = getSubdomain(w);
          const vertical = getVertical(w);
          return (
            <Pressable
              key={w.id}
              style={({ pressed }) => [
                styles.workspaceCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setSelectedWorkspace(w)}>
              <View style={styles.workspaceInfo}>
                <Text style={[styles.workspaceTitle, { color: theme.text }]}>{w.title}</Text>
                <Text style={[styles.workspaceSubdomain, { color: theme.textMuted }]}>
                  {subdomain}.tarai.space
                </Text>
              </View>
              <View style={[styles.verticalTag, { backgroundColor: theme.primary + '15' }]}>
                <Text style={[styles.verticalTagText, { color: theme.primary }]}>{vertical}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.createBtnFull, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/onboarding')}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnFullText}>Create New Workspace</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subdomain: {
    fontSize: 13,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  productCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  productCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  productValues: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  productQty: {
    fontSize: 12,
    marginTop: 2,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
  },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  workspaceCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceInfo: {
    flex: 1,
    gap: 2,
  },
  workspaceTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  workspaceSubdomain: {
    fontSize: 13,
  },
  verticalTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verticalTagText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bottomBar: {
    paddingHorizontal: 16,
  },
  createBtnFull: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  createBtnFullText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
