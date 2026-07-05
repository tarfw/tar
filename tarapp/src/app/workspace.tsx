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

  // Route parameters
  const { id, name, subdomain, scope } = useLocalSearchParams<{
    id: string;
    name: string;
    subdomain: string;
    scope: string;
  }>();

  const [activeTab, setActiveTab] = useState<'storefront' | 'products' | 'info'>('storefront');

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

  const fetchProducts = useCallback(async () => {
    if (!scope) return;
    setLoadingProducts(true);
    try {
      const result = await tar.tool('read', {
        table: 'matter',
        type: 'product',
        active: 1,
        scope,
      });
      setProducts(result.rows || []);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch products:', e);
    } finally {
      setLoadingProducts(false);
    }
  }, [scope]);

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    }
  }, [activeTab, fetchProducts]);

  const handleAddProduct = async () => {
    if (!productTitle.trim() || !productPrice.trim() || !scope) {
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
      await tar.tool('create', {
        table: 'matter',
        scope: scope,
        type: 'product',
        title: productTitle.trim(),
        value: val,
        qty: productQty ? parseInt(productQty, 10) : 0,
        data: {
          category: productCategory.trim() || 'General',
        },
      });

      // Reset form
      setProductTitle('');
      setProductPrice('');
      setProductQty('');
      setProductCategory('');
      setShowAddForm(false);

      // Refresh product list
      await fetchProducts();
    } catch (e: any) {
      setFormError(e.message || 'Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {name || 'Workspace'}
          </Text>
          <Text style={[styles.subdomain, { color: theme.textMuted }]}>
            {subdomain ? `${subdomain}.tarai.space` : 'No subdomain'}
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
              activeTab === tab && [styles.tabButtonActive, { borderBottomColor: theme.primary }],
            ]}
            onPress={() => setActiveTab(tab)}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? theme.primary : theme.textMuted },
                activeTab === tab && styles.tabTextActive,
              ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'storefront' && id && (
          <StorefrontTab
            storeId={id}
            storeName={name || ''}
            subdomain={subdomain}
            products={products}
          />
        )}

        {activeTab === 'products' && (
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

        {activeTab === 'info' && (
          <ScrollView style={styles.infoContainer} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.infoCardTitle, { color: theme.text }]}>Workspace Information</Text>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Scope ID</Text>
                <Text selectable style={[styles.infoVal, { color: theme.text }]}>{scope}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Form ID</Text>
                <Text selectable style={[styles.infoVal, { color: theme.text }]}>{id}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Domain</Text>
                <Text selectable style={[styles.infoVal, { color: theme.text }]}>
                  {subdomain ? `https://${subdomain}.tarai.space` : 'N/A'}
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
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
    fontSize: 20,
    fontWeight: '700',
  },
  subdomain: {
    fontSize: 12,
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
});
