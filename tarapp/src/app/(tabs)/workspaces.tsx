import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';
import StorefrontTab from '@/components/StorefrontTab';
import { AITaskCard, AITask } from '@/components/AITaskCard';
import { AITaskForm } from '@/components/AITaskForm';

interface Workspace { scope: string; subdomain: string; role: string; name?: string; }
interface Product { id: string; title: string; qty: number; value: number; data: string; }

export default function WorkspacesTabScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'storefront' | 'products' | 'tasks' | 'info'>('storefront');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productQty, setProductQty] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

  // AI Tasks State
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<AITask | null>(null);
  const [executingTask, setExecutingTask] = useState(false);
  const [executionError, setExecutionError] = useState('');

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

  const fetchTasks = useCallback(async () => {
    if (!selected?.scope) return;
    setLoadingTasks(true);
    try {
      const result = await tar.aiTasks(selected.scope);
      setTasks(result.actions || []);
    } catch (e) {
      console.warn('[Workspaces] Failed to fetch tasks:', e);
    } finally {
      setLoadingTasks(false);
    }
  }, [selected?.scope]);

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, fetchProducts, fetchTasks]);

  // Reset workspace-specific states when switching workspaces
  useEffect(() => {
    setActiveTask(null);
    setSearchQuery('');
    setSelectedCategory(null);
    setExecutionError('');
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'tasks') fetchTasks();
  }, [selected?.scope]);

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

  const handleExecuteTask = async (values: Record<string, any>) => {
    if (!activeTask || !selected?.scope) return;
    setExecutingTask(true);
    setExecutionError('');
    try {
      if (activeTask.steps === 1 && activeTask.tool && activeTask.tool !== 'custom') {
        const toolInput: any = {
          table: activeTask.table,
          type: activeTask.type,
          scope: selected.scope
        };
        if (values.title !== undefined) toolInput.title = values.title;
        if (values.name !== undefined && !values.title) toolInput.title = values.name;
        if (values.value !== undefined) toolInput.value = values.value;
        if (values.price !== undefined && values.value === undefined) toolInput.value = values.price;
        if (values.qty !== undefined) toolInput.qty = values.qty;
        
        toolInput.data = { ...values };

        if (activeTask.tool === 'update') {
          const id = values.id || values.productId || values.orderId || values.leadId || values.bookingId;
          if (!id) throw new Error('ID parameter is required to update');
          await tar.tool('update', {
            table: activeTask.table,
            id,
            scope: selected.scope,
            patch: values
          });
        } else if (activeTask.tool === 'delete') {
          const id = values.id || values.productId || values.orderId || values.leadId || values.bookingId;
          if (!id) throw new Error('ID parameter is required to delete');
          await tar.tool('delete', {
            table: activeTask.table,
            id,
            scope: selected.scope
          });
        } else {
          await tar.tool(activeTask.tool, toolInput);
        }
      } else {
        const result = await tar.executeAITask(activeTask.name, values, selected.scope);
        if (!result.success) {
          throw new Error(result.error || 'Execution failed');
        }
      }
      setActiveTask(null);
      if (activeTask.module === 'inventory' || activeTask.name.includes('product')) {
        await fetchProducts();
      }
    } catch (e: any) {
      setExecutionError(e.message || 'Failed to execute task');
    } finally {
      setExecutingTask(false);
    }
  };

  const sub = selected?.subdomain || selected?.scope?.replace('w:', '') || '';
  const categories = Array.from(new Set(tasks.map(t => t.module)));
  
  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.intents && task.intents.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = !selectedCategory || task.module === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        {(['storefront', 'products', 'tasks', 'info'] as const).map((t) => (
          <Pressable key={t} style={[styles.tab, activeTab === t && { borderBottomColor: theme.primary }]}
            onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, { color: activeTab === t ? theme.primary : theme.textMuted },
              activeTab === t && { fontWeight: '600' }]}>
              {t === 'tasks' ? 'AI Tasks' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
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

        {activeTab === 'tasks' && (
          <View style={{ flex: 1 }}>
            {activeTask ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <AITaskForm
                  task={activeTask}
                  onSubmit={handleExecuteTask}
                  onCancel={() => { setActiveTask(null); setExecutionError(''); }}
                  executing={executingTask}
                />
                {executionError ? (
                  <Text style={[styles.error, { marginTop: 12, textAlign: 'center' }]}>{executionError}</Text>
                ) : null}
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                {/* Search Bar */}
                <View style={[styles.searchBar, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="search" size={16} color={theme.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search actions or intents..."
                    placeholderTextColor={theme.textMuted}
                  />
                  {searchQuery ? (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Category Chips */}
                {categories.length > 0 && (
                  <View style={styles.chipsWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                      <Pressable
                        style={[
                          styles.chip,
                          {
                            borderColor: theme.border,
                            backgroundColor: !selectedCategory ? theme.primary : theme.backgroundElement
                          }
                        ]}
                        onPress={() => setSelectedCategory(null)}
                      >
                        <Text style={[styles.chipText, { color: !selectedCategory ? '#fff' : theme.textSecondary }]}>
                          All
                        </Text>
                      </Pressable>
                      {categories.map(cat => (
                        <Pressable
                          key={cat}
                          style={[
                            styles.chip,
                            {
                              borderColor: theme.border,
                              backgroundColor: selectedCategory === cat ? theme.primary : theme.backgroundElement
                            }
                          ]}
                          onPress={() => setSelectedCategory(cat)}
                        >
                          <Text style={[styles.chipText, { color: selectedCategory === cat ? '#fff' : theme.textSecondary }]}>
                            {cat}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Task List */}
                {loadingTasks ? (
                  <ActivityIndicator style={{ marginTop: 32 }} color={theme.textSecondary} />
                ) : filteredTasks.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="flash-off-outline" size={40} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                      {searchQuery || selectedCategory ? 'No matching tasks' : 'No AI Tasks found'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
                    {filteredTasks.map(task => (
                      <AITaskCard
                        key={task.name}
                        task={task}
                        onPress={() => {
                          setActiveTask(task);
                          setExecutionError('');
                        }}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
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
  emptyText: { fontSize: 14 },
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
  // AI Tasks styles
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chipsWrapper: {
    marginBottom: 8,
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
